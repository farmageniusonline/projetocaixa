-- =============================================
-- SEED DATA - DADOS INICIAIS DO SISTEMA
-- =============================================
-- Este arquivo contém dados de exemplo para desenvolvimento e teste

-- =============================================
-- CONFIGURAÇÕES INICIAIS
-- =============================================

-- Inserir algumas configurações de sistema se necessário
-- (Pode ser expandido conforme necessidades futuras)

-- =============================================
-- DADOS DE EXEMPLO PARA DESENVOLVIMENTO
-- =============================================
-- Descomente as seções abaixo apenas para ambiente de desenvolvimento

-- IMPORTANTE: NÃO usar em produção - apenas para desenvolvimento local

/*
-- Exemplo de perfil de usuário de teste
-- ATENÇÃO: Este UUID deve corresponder a um usuário real criado via auth
INSERT INTO public.profiles (
  id,
  username,
  full_name,
  role,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- UUID fictício - substitua por um real
  'admin_test',
  'Administrador de Teste',
  'admin',
  true
) ON CONFLICT (id) DO NOTHING;

-- Arquivo de exemplo
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
  processing_time_ms,
  metadata
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'exemplo_extrato_2024.xlsx',
  'Extrato Bancário - Janeiro 2024.xlsx',
  256000,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'completed',
  200,
  195,
  5,
  12,
  3450,
  '{"source": "manual_upload", "columns_mapped": {"date": "A", "type": "B", "cpf": "C", "value": "D", "history": "E"}}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Transações bancárias de exemplo
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
  status,
  original_data
) VALUES
  (
    '20000000-0000-0000-0001-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-15',
    'PIX RECEBIDO',
    '12345678901',
    150.00,
    'PIX RECEBIDO - JOAO DA SILVA - CPF: 12345678901 - VENDA MEDICAMENTO',
    1,
    'pending',
    '{"raw_date": "15/01/2024", "raw_value": "R$ 150,00", "raw_type": "PIX REC"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-15',
    'TED',
    '98765432100',
    -275.50,
    'TED ENVIADA - FORNECEDOR ABC LTDA - CPF: 98765432100 - PGTO FORNECEDOR',
    2,
    'pending',
    '{"raw_date": "15/01/2024", "raw_value": "-R$ 275,50", "raw_type": "TED ENV"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-15',
    'CARTÃO',
    NULL,
    89.90,
    'COMPRA CARTAO DEBITO - DROGARIA XYZ - MEDICAMENTOS',
    3,
    'pending',
    '{"raw_date": "15/01/2024", "raw_value": "R$ 89,90", "raw_type": "CARTAO"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-16',
    'PIX ENVIADO',
    '11122233344',
    -45.30,
    'PIX ENVIADO - MARIA OLIVEIRA - CPF: 11122233344 - REEMBOLSO',
    4,
    'pending',
    '{"raw_date": "16/01/2024", "raw_value": "-R$ 45,30", "raw_type": "PIX ENV"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-16',
    'PIX RECEBIDO',
    '55566677788',
    320.75,
    'PIX RECEBIDO - CLIENTE PREMIUM - CPF: 55566677788 - MANIPULADOS',
    5,
    'pending',
    '{"raw_date": "16/01/2024", "raw_value": "R$ 320,75", "raw_type": "PIX REC"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-17',
    'TRANSFERÊNCIA',
    NULL,
    -1200.00,
    'TRANSFERENCIA CONTA POUPANCA - RESERVA EMERGENCIAL',
    6,
    'pending',
    '{"raw_date": "17/01/2024", "raw_value": "-R$ 1.200,00", "raw_type": "TRANSF"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000007',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-17',
    'PIX RECEBIDO',
    '99988877766',
    67.80,
    'PIX RECEBIDO - JOSE SANTOS - CPF: 99988877766 - VITAMINAS',
    7,
    'pending',
    '{"raw_date": "17/01/2024", "raw_value": "R$ 67,80", "raw_type": "PIX REC"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000008',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-18',
    'CARTÃO',
    NULL,
    125.40,
    'COMPRA CARTAO CREDITO - FARMACIA ONLINE - ENTREGA DOMICILIO',
    8,
    'pending',
    '{"raw_date": "18/01/2024", "raw_value": "R$ 125,40", "raw_type": "CARTAO"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000009',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-18',
    'PIX RECEBIDO',
    '33344455566',
    89.90,
    'PIX RECEBIDO - ANA COSTA - CPF: 33344455566 - COSMETICOS',
    9,
    'conferred',
    '{"raw_date": "18/01/2024", "raw_value": "R$ 89,90", "raw_type": "PIX REC"}'::jsonb
  ),
  (
    '20000000-0000-0000-0001-000000000010',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2024-01-19',
    'TED',
    '77788899900',
    -450.00,
    'TED ENVIADA - LABORATORIO DEF - CPF: 77788899900 - MATERIA PRIMA',
    10,
    'pending',
    '{"raw_date": "19/01/2024", "raw_value": "-R$ 450,00", "raw_type": "TED ENV"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Exemplo de conferência já realizada
INSERT INTO public.cash_conference (
  id,
  user_id,
  transaction_id,
  conferred_value,
  conference_date,
  transaction_date,
  payment_type,
  cpf,
  original_value,
  original_history
) VALUES (
  '30000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0001-000000000009',
  89.90,
  '2024-01-18 14:30:00+00',
  '2024-01-18',
  'PIX RECEBIDO',
  '33344455566',
  89.90,
  'PIX RECEBIDO - ANA COSTA - CPF: 33344455566 - COSMETICOS'
) ON CONFLICT (user_id, transaction_id) DO NOTHING;

-- Marcar a transação como transferida
UPDATE public.banking_transactions
SET status = 'conferred', is_transferred = true
WHERE id = '20000000-0000-0000-0001-000000000009';

-- Exemplo de valores não encontrados
INSERT INTO public.not_found_history (
  id,
  user_id,
  searched_value,
  normalized_value,
  search_timestamp,
  search_context,
  file_id
) VALUES
  (
    '40000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'R$ 99,99',
    99.99,
    '2024-01-18 10:15:00+00',
    '{"search_method": "manual", "user_input": "99,99", "matches_found": 0}'::jsonb,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'R$ 234,56',
    234.56,
    '2024-01-18 15:22:00+00',
    '{"search_method": "manual", "user_input": "234.56", "matches_found": 0}'::jsonb,
    '10000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

-- Criar sessão de trabalho para os dados de exemplo
INSERT INTO public.work_sessions (
  id,
  user_id,
  session_date,
  session_name,
  started_at,
  total_transactions,
  conferred_transactions,
  not_found_searches,
  session_status
) VALUES (
  '50000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '2024-01-18',
  'Conferência Janeiro - Dia 18',
  '2024-01-18 08:00:00+00',
  10,
  1,
  2,
  'active'
) ON CONFLICT (user_id, session_date) DO NOTHING;

*/

-- =============================================
-- MENSAGEM DE CONCLUSÃO
-- =============================================
-- Esta migration está completa e pronta para uso
-- Os dados de exemplo estão comentados para segurança