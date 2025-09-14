-- =============================================
-- FUNÇÕES E TRIGGERS PARA SISTEMA DE CONFERÊNCIA
-- =============================================

-- =============================================
-- 1. FUNÇÃO PARA BUSCAR TRANSAÇÕES POR VALOR
-- =============================================
CREATE OR REPLACE FUNCTION search_transactions_by_value(
  p_user_id UUID,
  p_value DECIMAL(15, 2),
  p_tolerance DECIMAL(15, 2) DEFAULT 0.01
)
RETURNS TABLE(
  id UUID,
  transaction_date DATE,
  payment_type TEXT,
  cpf TEXT,
  value DECIMAL(15, 2),
  original_history TEXT,
  row_index INTEGER,
  is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bt.id,
    bt.transaction_date,
    bt.payment_type,
    bt.cpf,
    bt.value,
    bt.original_history,
    bt.row_index,
    (bt.status = 'pending' AND NOT bt.is_transferred) as is_available
  FROM public.banking_transactions bt
  WHERE
    bt.user_id = p_user_id
    AND ABS(bt.normalized_value - p_value) <= p_tolerance
    AND bt.status != 'archived'
  ORDER BY
    bt.transaction_date DESC,
    bt.created_at DESC;
END;
$$;

-- =============================================
-- 2. FUNÇÃO PARA TRANSFERIR TRANSAÇÃO PARA CONFERÊNCIA
-- =============================================
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

  -- Iniciar transação
  BEGIN
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
    SELECT json_build_object(
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
    ) INTO v_result;

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
END;
$$;

-- =============================================
-- 3. FUNÇÃO PARA REMOVER ITEM DA CONFERÊNCIA
-- =============================================
CREATE OR REPLACE FUNCTION remove_from_conference(
  p_user_id UUID,
  p_conference_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conference_record RECORD;
  v_result JSON;
BEGIN
  -- Verificar se a conferência existe e pertence ao usuário
  SELECT * INTO v_conference_record
  FROM public.cash_conference
  WHERE id = p_conference_id
    AND user_id = p_user_id
    AND conference_status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Conferência não encontrada ou já foi removida'
    );
  END IF;

  -- Iniciar transação
  BEGIN
    -- Marcar conferência como removida
    UPDATE public.cash_conference
    SET
      conference_status = 'removed',
      removed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_conference_id;

    -- Restaurar status da transação original
    UPDATE public.banking_transactions
    SET
      status = 'pending',
      is_transferred = false,
      updated_at = NOW()
    WHERE id = v_conference_record.transaction_id;

    RETURN json_build_object(
      'success', true,
      'message', 'Item removido da conferência com sucesso'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Erro interno: ' || SQLERRM
      );
  END;
END;
$$;

-- =============================================
-- 4. FUNÇÃO PARA REGISTRAR VALOR NÃO ENCONTRADO
-- =============================================
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
    search_context
  ) VALUES (
    p_user_id,
    p_searched_value,
    p_normalized_value,
    p_file_id,
    p_context
  ) RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

-- =============================================
-- 5. FUNÇÃO PARA OBTER ESTATÍSTICAS DO USUÁRIO
-- =============================================
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  WITH stats AS (
    SELECT
      -- Transações bancárias
      COALESCE(COUNT(bt.id), 0) as total_transactions,
      COALESCE(COUNT(bt.id) FILTER (WHERE bt.status = 'pending'), 0) as pending_transactions,
      COALESCE(COUNT(bt.id) FILTER (WHERE bt.status = 'conferred'), 0) as conferred_transactions,
      COALESCE(SUM(bt.value), 0) as total_value,
      COALESCE(SUM(bt.value) FILTER (WHERE bt.status = 'conferred'), 0) as conferred_value,

      -- Conferências ativas
      COALESCE(cc_stats.active_conferences, 0) as active_conferences,
      COALESCE(cc_stats.today_conferences, 0) as today_conferences,

      -- Valores não encontrados
      COALESCE(nf_stats.not_found_today, 0) as not_found_today,
      COALESCE(nf_stats.not_found_total, 0) as not_found_total

    FROM public.banking_transactions bt

    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*) FILTER (WHERE conference_status = 'active') as active_conferences,
        COUNT(*) FILTER (WHERE DATE(conference_date) = CURRENT_DATE) as today_conferences
      FROM public.cash_conference
      WHERE user_id = p_user_id
      GROUP BY user_id
    ) cc_stats ON bt.user_id = cc_stats.user_id

    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*) FILTER (WHERE DATE(search_timestamp) = CURRENT_DATE) as not_found_today,
        COUNT(*) as not_found_total
      FROM public.not_found_history
      WHERE user_id = p_user_id AND status = 'not_found'
      GROUP BY user_id
    ) nf_stats ON bt.user_id = nf_stats.user_id

    WHERE bt.user_id = p_user_id
  )
  SELECT json_build_object(
    'total_transactions', total_transactions,
    'pending_transactions', pending_transactions,
    'conferred_transactions', conferred_transactions,
    'total_value', total_value,
    'conferred_value', conferred_value,
    'active_conferences', active_conferences,
    'today_conferences', today_conferences,
    'not_found_today', not_found_today,
    'not_found_total', not_found_total,
    'completion_percentage',
      CASE
        WHEN total_transactions > 0 THEN ROUND((conferred_transactions::DECIMAL / total_transactions * 100), 2)
        ELSE 0
      END
  ) INTO v_stats
  FROM stats;

  RETURN COALESCE(v_stats, json_build_object(
    'total_transactions', 0,
    'pending_transactions', 0,
    'conferred_transactions', 0,
    'total_value', 0,
    'conferred_value', 0,
    'active_conferences', 0,
    'today_conferences', 0,
    'not_found_today', 0,
    'not_found_total', 0,
    'completion_percentage', 0
  ));
END;
$$;

-- =============================================
-- 6. FUNÇÃO PARA REINICIAR DIA DE TRABALHO
-- =============================================
CREATE OR REPLACE FUNCTION restart_work_day(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected_rows INTEGER := 0;
  v_result JSON;
BEGIN
  BEGIN
    -- Remover todas as conferências ativas do usuário
    UPDATE public.cash_conference
    SET
      conference_status = 'removed',
      removed_at = NOW(),
      updated_at = NOW()
    WHERE user_id = p_user_id
      AND conference_status = 'active';

    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

    -- Restaurar status de todas as transações conferidas
    UPDATE public.banking_transactions
    SET
      status = 'pending',
      is_transferred = false,
      updated_at = NOW()
    WHERE user_id = p_user_id
      AND status = 'conferred';

    -- Arquivar histórico de valores não encontrados do dia atual
    UPDATE public.not_found_history
    SET
      status = 'archived',
      updated_at = NOW()
    WHERE user_id = p_user_id
      AND DATE(search_timestamp) = CURRENT_DATE
      AND status = 'not_found';

    RETURN json_build_object(
      'success', true,
      'message', 'Dia de trabalho reiniciado com sucesso',
      'removed_conferences', v_affected_rows
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Erro interno: ' || SQLERRM
      );
  END;
END;
$$;

-- =============================================
-- 7. TRIGGER PARA ATUALIZAR SESSÃO DE TRABALHO
-- =============================================
CREATE OR REPLACE FUNCTION update_work_session_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_date DATE;
BEGIN
  -- Determinar a data da sessão baseada no contexto
  v_session_date := CASE
    WHEN TG_TABLE_NAME = 'cash_conference' THEN DATE(COALESCE(NEW.conference_date, OLD.conference_date))
    WHEN TG_TABLE_NAME = 'not_found_history' THEN DATE(COALESCE(NEW.search_timestamp, OLD.search_timestamp))
    ELSE CURRENT_DATE
  END;

  -- Inserir ou atualizar sessão de trabalho
  INSERT INTO public.work_sessions (user_id, session_date)
  VALUES (COALESCE(NEW.user_id, OLD.user_id), v_session_date)
  ON CONFLICT (user_id, session_date)
  DO UPDATE SET
    updated_at = NOW(),
    session_status = 'active';

  -- Atualizar estatísticas da sessão
  UPDATE public.work_sessions
  SET
    conferred_transactions = (
      SELECT COUNT(*) FROM public.cash_conference
      WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
        AND DATE(conference_date) = v_session_date
        AND conference_status = 'active'
    ),
    not_found_searches = (
      SELECT COUNT(*) FROM public.not_found_history
      WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
        AND DATE(search_timestamp) = v_session_date
        AND status = 'not_found'
    ),
    updated_at = NOW()
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND session_date = v_session_date;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar triggers
CREATE TRIGGER trigger_update_work_session_on_conference
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_conference
  FOR EACH ROW EXECUTE FUNCTION update_work_session_stats();

CREATE TRIGGER trigger_update_work_session_on_not_found
  AFTER INSERT OR UPDATE OR DELETE ON public.not_found_history
  FOR EACH ROW EXECUTE FUNCTION update_work_session_stats();

-- =============================================
-- 8. FUNÇÃO PARA CLEANUP DE DADOS ANTIGOS
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_old_data(p_days_old INTEGER DEFAULT 90)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff_date TIMESTAMP WITH TIME ZONE;
  v_deleted_sessions INTEGER := 0;
  v_deleted_not_found INTEGER := 0;
  v_result JSON;
BEGIN
  v_cutoff_date := NOW() - (p_days_old || ' days')::INTERVAL;

  -- Arquivar sessões antigas
  UPDATE public.work_sessions
  SET session_status = 'archived', updated_at = NOW()
  WHERE created_at < v_cutoff_date AND session_status != 'archived';

  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  -- Arquivar histórico antigo de valores não encontrados
  UPDATE public.not_found_history
  SET status = 'archived', updated_at = NOW()
  WHERE created_at < v_cutoff_date AND status = 'not_found';

  GET DIAGNOSTICS v_deleted_not_found = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'cutoff_date', v_cutoff_date,
    'archived_sessions', v_deleted_sessions,
    'archived_not_found', v_deleted_not_found
  );
END;
$$;

-- =============================================
-- VIEWS ÚTEIS PARA RELATÓRIOS
-- =============================================

-- View para conferências ativas com detalhes
CREATE OR REPLACE VIEW v_active_conferences AS
SELECT
  cc.id,
  cc.user_id,
  p.username,
  cc.conference_date,
  cc.transaction_date,
  cc.payment_type,
  cc.cpf,
  cc.conferred_value,
  cc.original_history,
  cc.created_at
FROM public.cash_conference cc
JOIN public.profiles p ON cc.user_id = p.id
WHERE cc.conference_status = 'active'
ORDER BY cc.conference_date DESC;

-- View para transações pendentes
CREATE OR REPLACE VIEW v_pending_transactions AS
SELECT
  bt.id,
  bt.user_id,
  p.username,
  bt.transaction_date,
  bt.payment_type,
  bt.cpf,
  bt.value,
  bt.original_history,
  bt.created_at
FROM public.banking_transactions bt
JOIN public.profiles p ON bt.user_id = p.id
WHERE bt.status = 'pending' AND NOT bt.is_transferred
ORDER BY bt.transaction_date DESC;

-- View para estatísticas diárias por usuário
CREATE OR REPLACE VIEW v_daily_stats AS
SELECT
  ws.user_id,
  p.username,
  ws.session_date,
  ws.conferred_transactions,
  ws.not_found_searches,
  ws.session_status,
  COALESCE(SUM(cc.conferred_value), 0) as total_conferred_value
FROM public.work_sessions ws
JOIN public.profiles p ON ws.user_id = p.id
LEFT JOIN public.cash_conference cc ON cc.user_id = ws.user_id
  AND DATE(cc.conference_date) = ws.session_date
  AND cc.conference_status = 'active'
GROUP BY ws.user_id, p.username, ws.session_date, ws.conferred_transactions,
         ws.not_found_searches, ws.session_status
ORDER BY ws.session_date DESC, p.username;