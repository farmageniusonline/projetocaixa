-- Banco de dados atualizado para sistema de conferência bancária
-- Compatível com ConferenceHistoryService

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela principal de histórico de conferência
CREATE TABLE IF NOT EXISTS conference_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    operation_date VARCHAR(10) NOT NULL, -- formato DD-MM-YYYY
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('banking_upload', 'cash_conference', 'not_found')),
    operation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Campos comuns
    document_number VARCHAR(100),
    date VARCHAR(10), -- formato DD-MM-YYYY
    description TEXT,
    value DECIMAL(12,2),

    -- Campos específicos de transação bancária
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    transaction_type VARCHAR(50),
    balance DECIMAL(12,2),

    -- Campos específicos de conferência
    conferred_at TIMESTAMP WITH TIME ZONE,
    conferred_by VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('conferred', 'not_found', 'pending')),

    -- Informações de upload de arquivo
    file_name VARCHAR(255),
    file_upload_date VARCHAR(10), -- formato DD-MM-YYYY
    upload_mode VARCHAR(20) CHECK (upload_mode IN ('automatic', 'manual')),

    -- Metadados
    metadata JSONB,
    user_id VARCHAR(100) NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conference_history_operation_date ON conference_history(operation_date);
CREATE INDEX IF NOT EXISTS idx_conference_history_user_id ON conference_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conference_history_operation_type ON conference_history(operation_type);
CREATE INDEX IF NOT EXISTS idx_conference_history_status ON conference_history(status);

-- View para resumo diário (daily_summary)
CREATE OR REPLACE VIEW daily_summary AS
SELECT
    operation_date,
    user_id,

    -- Totais de upload bancário
    COUNT(CASE WHEN operation_type = 'banking_upload' THEN 1 END) as banking_total_uploaded,
    COALESCE(SUM(CASE WHEN operation_type = 'banking_upload' THEN value END), 0) as banking_total_value,

    -- Totais de conferidos (banking)
    COUNT(CASE WHEN operation_type = 'banking_upload' AND status = 'conferred' THEN 1 END) as banking_conferred_count,
    COALESCE(SUM(CASE WHEN operation_type = 'banking_upload' AND status = 'conferred' THEN value END), 0) as banking_conferred_value,

    -- Totais de conferência de caixa
    COUNT(CASE WHEN operation_type = 'cash_conference' AND status = 'conferred' THEN 1 END) as cash_conferred_count,
    COALESCE(SUM(CASE WHEN operation_type = 'cash_conference' AND status = 'conferred' THEN value END), 0) as cash_conferred_value,

    -- Totais de não encontrados
    COUNT(CASE WHEN operation_type = 'not_found' THEN 1 END) as cash_not_found_count,

    -- Último arquivo carregado
    MAX(CASE WHEN operation_type = 'banking_upload' THEN file_name END) as last_file_name,
    MAX(CASE WHEN operation_type = 'banking_upload' THEN operation_timestamp END) as last_upload_timestamp,

    -- Totais gerais de conferidos
    COUNT(CASE WHEN status = 'conferred' THEN 1 END) as total_conferred,
    COALESCE(SUM(CASE WHEN status = 'conferred' THEN value END), 0) as total_value

FROM conference_history
GROUP BY operation_date, user_id;

-- Tabela de usuários (mantida para compatibilidade)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir usuário padrão para desenvolvimento
INSERT INTO users (id, username, password_hash) VALUES
('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$rOzuKZgUWpOJjM2jKxLmEO9IgQNKQl4Z2WLzJXzKQg2lKzO5H3FuG') -- senha: admin123
ON CONFLICT (username) DO NOTHING;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_conference_history_updated_at BEFORE UPDATE ON conference_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função RPC para buscar transações por valor
CREATE OR REPLACE FUNCTION search_transactions_by_value(
    p_user_id VARCHAR,
    p_value DECIMAL
)
RETURNS SETOF conference_history AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM conference_history
    WHERE user_id = p_user_id
      AND value = p_value
      AND operation_type = 'banking_upload'
      AND status = 'pending'
    ORDER BY operation_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- Função RPC para transferir para conferência
CREATE OR REPLACE FUNCTION transfer_to_conference(
    p_user_id VARCHAR,
    p_transaction_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE conference_history
    SET status = 'conferred',
        conferred_at = NOW(),
        conferred_by = p_user_id
    WHERE id = p_transaction_id
      AND user_id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Função RPC para remover da conferência
CREATE OR REPLACE FUNCTION remove_from_conference(
    p_user_id VARCHAR,
    p_conference_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE conference_history
    SET status = 'pending',
        conferred_at = NULL,
        conferred_by = NULL
    WHERE id = p_conference_id
      AND user_id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Função RPC para registrar valor não encontrado
CREATE OR REPLACE FUNCTION register_not_found(
    p_user_id VARCHAR,
    p_searched_value VARCHAR,
    p_normalized_value DECIMAL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO conference_history (
        operation_date,
        operation_type,
        value,
        status,
        user_id,
        metadata
    )
    VALUES (
        TO_CHAR(CURRENT_DATE, 'DD-MM-YYYY'),
        'not_found',
        p_normalized_value,
        'not_found',
        p_user_id,
        jsonb_build_object('originalValue', p_searched_value)
    )
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Função RPC para obter estatísticas do usuário
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id VARCHAR)
RETURNS TABLE (
    total_uploaded INTEGER,
    total_conferred INTEGER,
    total_not_found INTEGER,
    total_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(CASE WHEN operation_type = 'banking_upload' THEN 1 END)::INTEGER as total_uploaded,
        COUNT(CASE WHEN status = 'conferred' THEN 1 END)::INTEGER as total_conferred,
        COUNT(CASE WHEN operation_type = 'not_found' THEN 1 END)::INTEGER as total_not_found,
        COALESCE(SUM(CASE WHEN status = 'conferred' THEN value END), 0) as total_value
    FROM conference_history
    WHERE user_id = p_user_id
      AND operation_date = TO_CHAR(CURRENT_DATE, 'DD-MM-YYYY');
END;
$$ LANGUAGE plpgsql;

-- Função RPC para reiniciar dia de trabalho
CREATE OR REPLACE FUNCTION restart_work_day(p_user_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM conference_history
    WHERE user_id = p_user_id
      AND operation_date = TO_CHAR(CURRENT_DATE, 'DD-MM-YYYY');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;