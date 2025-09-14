-- Banco de dados local para desenvolvimento
-- Baseado nas migrações do Supabase

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de conferências de caixa
CREATE TABLE IF NOT EXISTS cash_conferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de itens de conferência
CREATE TABLE IF NOT EXISTS cash_conference_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conference_id UUID REFERENCES cash_conferences(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de histórico de não encontrados
CREATE TABLE IF NOT EXISTS not_found_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    searched_item VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir usuário padrão para desenvolvimento
INSERT INTO users (username, password_hash) VALUES
('admin', '$2b$10$rOzuKZgUWpOJjM2jKxLmEO9IgQNKQl4Z2WLzJXzKQg2lKzO5H3FuG') -- senha: admin123
ON CONFLICT (username) DO NOTHING;

-- Dados de exemplo para desenvolvimento
WITH admin_user AS (
    SELECT id FROM users WHERE username = 'admin' LIMIT 1
),
sample_conference AS (
    INSERT INTO cash_conferences (user_id, date, total_amount)
    SELECT id, CURRENT_DATE, 1500.00
    FROM admin_user
    RETURNING id
)
INSERT INTO cash_conference_items (conference_id, item_name, quantity, unit_value, total_value)
SELECT
    sample_conference.id,
    item_data.item_name,
    item_data.quantity,
    item_data.unit_value,
    item_data.total_value
FROM sample_conference,
(VALUES
    ('Notas de R$ 100', 10, 100.00, 1000.00),
    ('Notas de R$ 50', 5, 50.00, 250.00),
    ('Notas de R$ 20', 10, 20.00, 200.00),
    ('Moedas de R$ 1', 50, 1.00, 50.00)
) AS item_data(item_name, quantity, unit_value, total_value);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_conferences_updated_at BEFORE UPDATE ON cash_conferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();