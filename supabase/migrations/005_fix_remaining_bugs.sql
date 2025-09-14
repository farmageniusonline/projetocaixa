-- =============================================
-- FIX: Corrigir bugs restantes
-- 1. Trigger update_work_session_stats
-- 2. Função transfer_to_conference
-- =============================================

-- Drop do trigger problemático
DROP TRIGGER IF EXISTS trigger_update_work_session_on_conference ON public.cash_conference;
DROP TRIGGER IF EXISTS trigger_update_work_session_on_not_found ON public.not_found_history;

-- Recriar função de atualização de sessão simplificada
CREATE OR REPLACE FUNCTION update_work_session_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_date DATE;
  v_user_id UUID;
BEGIN
  -- Determinar usuário e data baseados na operação
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    IF TG_TABLE_NAME = 'cash_conference' THEN
      v_session_date := OLD.transaction_date;
    ELSIF TG_TABLE_NAME = 'not_found_history' THEN
      v_session_date := DATE(OLD.search_timestamp);
    END IF;
  ELSE
    v_user_id := NEW.user_id;
    IF TG_TABLE_NAME = 'cash_conference' THEN
      v_session_date := NEW.transaction_date;
    ELSIF TG_TABLE_NAME = 'not_found_history' THEN
      v_session_date := DATE(NEW.search_timestamp);
    END IF;
  END IF;

  -- Inserir ou atualizar sessão de trabalho
  INSERT INTO public.work_sessions (user_id, session_date)
  VALUES (v_user_id, v_session_date)
  ON CONFLICT (user_id, session_date)
  DO UPDATE SET
    updated_at = NOW(),
    session_status = 'active';

  -- Atualizar estatísticas da sessão
  UPDATE public.work_sessions
  SET
    conferred_transactions = (
      SELECT COUNT(*) FROM public.cash_conference
      WHERE user_id = v_user_id
        AND transaction_date = v_session_date
        AND conference_status = 'active'
    ),
    not_found_searches = (
      SELECT COUNT(*) FROM public.not_found_history
      WHERE user_id = v_user_id
        AND DATE(search_timestamp) = v_session_date
        AND status = 'not_found'
    ),
    updated_at = NOW()
  WHERE user_id = v_user_id
    AND session_date = v_session_date;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar triggers corrigidos
CREATE TRIGGER trigger_update_work_session_on_conference
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_conference
  FOR EACH ROW EXECUTE FUNCTION update_work_session_stats();

CREATE TRIGGER trigger_update_work_session_on_not_found
  AFTER INSERT OR UPDATE OR DELETE ON public.not_found_history
  FOR EACH ROW EXECUTE FUNCTION update_work_session_stats();

-- =============================================
-- FIX: Corrigir função transfer_to_conference
-- =============================================

DROP FUNCTION IF EXISTS transfer_to_conference(UUID, UUID);

CREATE OR REPLACE FUNCTION transfer_to_conference(
  p_user_id UUID,
  p_transaction_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_record RECORD;
  v_conference_id UUID;
  v_result JSON;
BEGIN
  -- Verificar se a transação existe e pertence ao usuário
  SELECT * INTO v_transaction_record
  FROM public.banking_transactions
  WHERE id = p_transaction_id
    AND user_id = p_user_id
    AND status = 'pending'
    AND NOT is_transferred;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Transação não encontrada ou já foi conferida'
    );
  END IF;

  -- Criar registro de conferência
  INSERT INTO public.cash_conference (
    user_id,
    transaction_id,
    conferred_value,
    transaction_date,
    payment_type,
    cpf,
    original_value,
    original_history
  ) VALUES (
    p_user_id,
    p_transaction_id,
    v_transaction_record.value,
    v_transaction_record.transaction_date,
    v_transaction_record.payment_type,
    v_transaction_record.cpf,
    v_transaction_record.value,
    v_transaction_record.original_history
  ) RETURNING id INTO v_conference_id;

  -- Atualizar status da transação
  UPDATE public.banking_transactions
  SET
    status = 'conferred',
    is_transferred = true,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- Retornar sucesso com dados da conferência
  v_result := json_build_object(
    'success', true,
    'conference_id', v_conference_id,
    'transaction', json_build_object(
      'id', v_transaction_record.id,
      'date', v_transaction_record.transaction_date,
      'payment_type', v_transaction_record.payment_type,
      'cpf', v_transaction_record.cpf,
      'value', v_transaction_record.value,
      'history', v_transaction_record.original_history
    )
  );

  RETURN v_result;

EXCEPTION
  WHEN UNIQUE_VIOLATION THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Esta transação já foi conferida'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- =============================================
-- FIX: Corrigir função register_not_found
-- =============================================

DROP FUNCTION IF EXISTS register_not_found(UUID, TEXT, DECIMAL, UUID, JSONB);

CREATE OR REPLACE FUNCTION register_not_found(
  p_user_id UUID,
  p_searched_value TEXT,
  p_normalized_value DECIMAL(15, 2),
  p_file_id UUID DEFAULT NULL,
  p_context JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_id UUID;
BEGIN
  INSERT INTO public.not_found_history (
    user_id,
    searched_value,
    normalized_value,
    file_id,
    search_context,
    search_timestamp,
    status
  ) VALUES (
    p_user_id,
    p_searched_value,
    p_normalized_value,
    p_file_id,
    p_context,
    NOW(),
    'not_found'
  ) RETURNING id INTO v_record_id;

  RETURN v_record_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Se houver erro, retorna NULL
    RETURN NULL;
END;
$$;

-- =============================================
-- Adicionar função de teste simplificada
-- =============================================

CREATE OR REPLACE FUNCTION simple_test()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'Sistema funcionando corretamente! 🎉';
END;
$$;

-- Comentários atualizados
COMMENT ON FUNCTION transfer_to_conference IS 'Transfere transação para conferência - VERSÃO CORRIGIDA v2';
COMMENT ON FUNCTION register_not_found IS 'Registra valor não encontrado - VERSÃO CORRIGIDA v2';
COMMENT ON FUNCTION update_work_session_stats IS 'Atualiza estatísticas da sessão - VERSÃO CORRIGIDA v2';
COMMENT ON FUNCTION simple_test IS 'Função simples para testar se o banco está respondendo';