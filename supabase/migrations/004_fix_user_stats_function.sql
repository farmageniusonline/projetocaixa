-- =============================================
-- FIX: Corrigir função get_user_stats
-- Erro: column must appear in GROUP BY clause
-- =============================================

-- Drop da função antiga
DROP FUNCTION IF EXISTS public.get_user_stats(UUID);

-- Recriar função corrigida
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  WITH transaction_stats AS (
    SELECT
      COUNT(*) as total_transactions,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_transactions,
      COUNT(*) FILTER (WHERE status = 'conferred') as conferred_transactions,
      COALESCE(SUM(value), 0) as total_value,
      COALESCE(SUM(value) FILTER (WHERE status = 'conferred'), 0) as conferred_value
    FROM public.banking_transactions
    WHERE user_id = p_user_id
  ),
  conference_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE conference_status = 'active') as active_conferences,
      COUNT(*) FILTER (WHERE DATE(conference_date) = CURRENT_DATE) as today_conferences
    FROM public.cash_conference
    WHERE user_id = p_user_id
  ),
  not_found_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE DATE(search_timestamp) = CURRENT_DATE) as not_found_today,
      COUNT(*) as not_found_total
    FROM public.not_found_history
    WHERE user_id = p_user_id AND status = 'not_found'
  )
  SELECT json_build_object(
    'total_transactions', COALESCE(t.total_transactions, 0),
    'pending_transactions', COALESCE(t.pending_transactions, 0),
    'conferred_transactions', COALESCE(t.conferred_transactions, 0),
    'total_value', COALESCE(t.total_value, 0),
    'conferred_value', COALESCE(t.conferred_value, 0),
    'active_conferences', COALESCE(c.active_conferences, 0),
    'today_conferences', COALESCE(c.today_conferences, 0),
    'not_found_today', COALESCE(n.not_found_today, 0),
    'not_found_total', COALESCE(n.not_found_total, 0),
    'completion_percentage',
      CASE
        WHEN COALESCE(t.total_transactions, 0) > 0
        THEN ROUND((COALESCE(t.conferred_transactions, 0)::DECIMAL / t.total_transactions * 100), 2)
        ELSE 0
      END
  ) INTO v_stats
  FROM transaction_stats t
  CROSS JOIN conference_stats c
  CROSS JOIN not_found_stats n;

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

-- Comentário atualizado
COMMENT ON FUNCTION public.get_user_stats IS 'Obtém estatísticas básicas do usuário - VERSÃO CORRIGIDA';

-- =============================================
-- FIX: Atualizar trigger de criação de perfil
-- Para garantir que funcione corretamente
-- =============================================

-- Drop do trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Função atualizada para criação de perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    role,
    is_active
  ) VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data->>'role',
      'user'
    )::text,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

  RETURN new;
END;
$$;

-- Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- VERIFICAÇÃO: Função para testar a conexão
-- =============================================
CREATE OR REPLACE FUNCTION test_connection()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'status', 'ok',
    'timestamp', NOW(),
    'database', current_database(),
    'user', current_user,
    'version', version()
  );
END;
$$;

COMMENT ON FUNCTION public.test_connection IS 'Função simples para testar se a conexão com o banco está funcionando';