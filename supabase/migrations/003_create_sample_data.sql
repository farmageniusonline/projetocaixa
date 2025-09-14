-- =============================================
-- DADOS DE EXEMPLO E CONFIGURAÇÕES INICIAIS
-- =============================================

-- =============================================
-- 1. INSERIR PERFIL PARA USUÁRIOS DE TESTE
-- =============================================
-- Esta função será chamada via trigger quando um usuário se registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 2. DADOS DE EXEMPLO (OPCIONAL)
-- =============================================
-- Descomente as seções abaixo se quiser dados de teste

/*
-- Exemplo de arquivo importado
INSERT INTO public.imported_files (
  id,
  user_id,
  filename,
  original_filename,
  file_size,
  file_type,
  processing_status,
  total_rows,
  valid_rows,
  error_rows,
  warnings_count,
  processing_time_ms
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001', -- Substitua por um UUID de usuário válido
  'extrato_bancario_exemplo.xlsx',
  'Extrato Bancário Janeiro 2024.xlsx',
  125440,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'completed',
  150,
  148,
  2,
  5,
  2340
) ON CONFLICT (id) DO NOTHING;

-- Exemplos de transações bancárias
INSERT INTO public.banking_transactions (
  id,
  file_id,
  user_id,
  transaction_date,
  payment_type,
  cpf,
  value,
  original_history,
  row_index,
  status
) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '2024-01-15',
    'PIX RECEBIDO',
    '12345678901',
    125.50,
    'PIX RECEBIDO - JOAO DA SILVA - CPF: 12345678901',
    1,
    'pending'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440011',
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '2024-01-15',
    'TED',
    '98765432100',
    -350.75,
    'TED ENVIADA - MARIA SANTOS - CPF: 98765432100',
    2,
    'pending'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440012',
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '2024-01-16',
    'CARTÃO',
    NULL,
    89.90,
    'COMPRA CARTAO DEBITO - FARMACIA ABC',
    3,
    'pending'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440013',
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '2024-01-16',
    'PIX ENVIADO',
    '11122233344',
    -67.30,
    'PIX ENVIADO - JOSE OLIVEIRA - CPF: 11122233344',
    4,
    'pending'
  )
ON CONFLICT (id) DO NOTHING;
*/

-- =============================================
-- 3. POLÍTICAS RLS ADICIONAIS
-- =============================================

-- Política para permitir que usuários vejam estatísticas agregadas
CREATE POLICY "Users can view aggregate stats" ON public.work_sessions
  FOR SELECT USING (true); -- Todos podem ver estatísticas gerais

-- =============================================
-- 4. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =============================================

-- Índices compostos para queries frequentes
CREATE INDEX IF NOT EXISTS idx_banking_transactions_user_date_status
  ON public.banking_transactions(user_id, transaction_date, status);

-- Índices simples para evitar problemas com funções não IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_cash_conference_user_date_status
  ON public.cash_conference(user_id, conference_status);

CREATE INDEX IF NOT EXISTS idx_not_found_user
  ON public.not_found_history(user_id, search_timestamp);

-- Índice para busca de valores
CREATE INDEX IF NOT EXISTS idx_banking_transactions_normalized_value_user
  ON public.banking_transactions(normalized_value, user_id)
  WHERE status != 'archived';

-- =============================================
-- 5. CONFIGURAÇÕES DE BACKUP E MANUTENÇÃO
-- =============================================

-- Função para backup seletivo de dados do usuário
CREATE OR REPLACE FUNCTION export_user_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'user_id', p_user_id,
    'export_date', NOW(),
    'profile', (
      SELECT row_to_json(p)
      FROM public.profiles p
      WHERE p.id = p_user_id
    ),
    'files', (
      SELECT json_agg(row_to_json(f))
      FROM public.imported_files f
      WHERE f.user_id = p_user_id
    ),
    'transactions', (
      SELECT json_agg(row_to_json(t))
      FROM public.banking_transactions t
      WHERE t.user_id = p_user_id
    ),
    'conferences', (
      SELECT json_agg(row_to_json(c))
      FROM public.cash_conference c
      WHERE c.user_id = p_user_id
    ),
    'not_found_history', (
      SELECT json_agg(row_to_json(n))
      FROM public.not_found_history n
      WHERE n.user_id = p_user_id
    ),
    'work_sessions', (
      SELECT json_agg(row_to_json(w))
      FROM public.work_sessions w
      WHERE w.user_id = p_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =============================================
-- 6. CONFIGURAÇÕES DE NOTIFICAÇÃO (OPCIONAL)
-- =============================================

-- Tabela para configurar notificações do sistema
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('info', 'warning', 'error', 'success')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS para notificações
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications" ON public.system_notifications
  FOR ALL USING (auth.uid() = user_id);

-- Índices para notificações
CREATE INDEX IF NOT EXISTS idx_system_notifications_user_read
  ON public.system_notifications(user_id, is_read, created_at DESC);

-- Trigger para updated_at em notificações
CREATE TRIGGER update_system_notifications_updated_at BEFORE UPDATE ON public.system_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 7. FUNÇÃO PARA ESTATÍSTICAS AVANÇADAS
-- =============================================
CREATE OR REPLACE FUNCTION get_advanced_stats(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
  v_stats JSON;
BEGIN
  WITH date_stats AS (
    SELECT
      -- Transações por dia
      DATE(bt.transaction_date) as stat_date,
      COUNT(bt.id) as daily_transactions,
      COUNT(bt.id) FILTER (WHERE bt.status = 'conferred') as daily_conferred,
      SUM(bt.value) as daily_total_value,
      SUM(bt.value) FILTER (WHERE bt.status = 'conferred') as daily_conferred_value,

      -- Conferências por dia
      COUNT(cc.id) as daily_conferences,

      -- Valores não encontrados por dia
      COUNT(nf.id) as daily_not_found

    FROM public.banking_transactions bt
    LEFT JOIN public.cash_conference cc ON bt.id = cc.transaction_id
      AND cc.conference_status = 'active'
      AND DATE(cc.conference_date) BETWEEN v_start_date AND v_end_date
    LEFT JOIN public.not_found_history nf ON nf.user_id = bt.user_id
      AND DATE(nf.search_timestamp) = DATE(bt.transaction_date)
      AND DATE(nf.search_timestamp) BETWEEN v_start_date AND v_end_date

    WHERE bt.user_id = p_user_id
      AND DATE(bt.transaction_date) BETWEEN v_start_date AND v_end_date
    GROUP BY DATE(bt.transaction_date)
    ORDER BY stat_date DESC
  ),
  payment_type_stats AS (
    SELECT
      bt.payment_type,
      COUNT(bt.id) as type_count,
      COUNT(bt.id) FILTER (WHERE bt.status = 'conferred') as type_conferred,
      AVG(bt.value) as avg_value,
      SUM(bt.value) as total_value
    FROM public.banking_transactions bt
    WHERE bt.user_id = p_user_id
      AND DATE(bt.transaction_date) BETWEEN v_start_date AND v_end_date
    GROUP BY bt.payment_type
    ORDER BY type_count DESC
  )

  SELECT json_build_object(
    'period', json_build_object(
      'start_date', v_start_date,
      'end_date', v_end_date,
      'days', v_end_date - v_start_date + 1
    ),
    'daily_stats', (
      SELECT json_agg(row_to_json(ds))
      FROM date_stats ds
    ),
    'payment_type_stats', (
      SELECT json_agg(row_to_json(pts))
      FROM payment_type_stats pts
    ),
    'summary', json_build_object(
      'total_days_with_activity', (
        SELECT COUNT(*) FROM date_stats WHERE daily_transactions > 0
      ),
      'most_productive_day', (
        SELECT stat_date FROM date_stats ORDER BY daily_conferred DESC LIMIT 1
      ),
      'avg_daily_conferences', (
        SELECT ROUND(AVG(daily_conferred), 2) FROM date_stats
      ),
      'completion_trend', (
        SELECT ROUND(
          AVG(CASE WHEN daily_transactions > 0 THEN daily_conferred::DECIMAL / daily_transactions * 100 ELSE 0 END), 2
        ) FROM date_stats
      )
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- =============================================
-- COMENTÁRIOS FINAIS
-- =============================================

COMMENT ON FUNCTION public.search_transactions_by_value IS 'Busca transações por valor com tolerância configurável';
COMMENT ON FUNCTION public.transfer_to_conference IS 'Move uma transação para conferência de caixa';
COMMENT ON FUNCTION public.remove_from_conference IS 'Remove item da conferência e restaura na lista principal';
COMMENT ON FUNCTION public.register_not_found IS 'Registra valor pesquisado mas não encontrado';
COMMENT ON FUNCTION public.get_user_stats IS 'Obtém estatísticas básicas do usuário';
COMMENT ON FUNCTION public.restart_work_day IS 'Reinicia o dia de trabalho do usuário';
COMMENT ON FUNCTION public.get_advanced_stats IS 'Obtém estatísticas avançadas com filtros de período';
COMMENT ON FUNCTION public.export_user_data IS 'Exporta todos os dados do usuário em formato JSON';
COMMENT ON FUNCTION public.cleanup_old_data IS 'Arquiva dados antigos para otimizar performance';

COMMENT ON VIEW public.v_active_conferences IS 'View de conferências ativas com informações do usuário';
COMMENT ON VIEW public.v_pending_transactions IS 'View de transações pendentes de conferência';
COMMENT ON VIEW public.v_daily_stats IS 'View de estatísticas diárias por usuário';