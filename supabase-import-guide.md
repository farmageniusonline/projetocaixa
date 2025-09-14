# 📋 Guia de Importação do Schema SQL para Supabase

## 🎯 Visão Geral

Este guia detalha como importar o schema completo do sistema de conferência de caixa no Supabase. O sistema foi desenvolvido para gerenciar conferências bancárias com recursos avançados de auditoria e controle de usuários.

## 📁 Estrutura dos Arquivos SQL

### 1. `001_create_initial_schema.sql`
- **Tabelas principais**: profiles, imported_files, banking_transactions, cash_conference, not_found_history, work_sessions
- **Índices de performance**
- **Row Level Security (RLS)**
- **Políticas de segurança**
- **Triggers de auditoria**

### 2. `002_create_functions_and_triggers.sql`
- **Funções de negócio**: busca de transações, transferência para conferência, estatísticas
- **Triggers avançados**: atualização automática de sessões
- **Views úteis**: conferências ativas, transações pendentes, estatísticas diárias
- **Funções de manutenção**: cleanup, backup de dados

### 3. `003_create_sample_data.sql`
- **Configurações iniciais**
- **Trigger para criação automática de perfis**
- **Dados de exemplo** (comentados para produção)
- **Índices adicionais**
- **Sistema de notificações**

### 4. `seed.sql`
- **Dados iniciais do sistema**
- **Exemplos para desenvolvimento** (comentados)

## 🚀 Como Importar no Supabase

### Método 1: SQL Editor (Recomendado)

1. **Acesse o Supabase Dashboard**
   ```
   https://app.supabase.com
   ```

2. **Entre no seu projeto**
   - Selecione o projeto: `jmqjmazlytblitipdrmf`

3. **Abra o SQL Editor**
   - Navegue até a aba "SQL Editor"
   - Clique em "New query"

4. **Execute os arquivos em ordem:**

   **Passo 1: Schema inicial**
   - Cole o conteúdo de `001_create_initial_schema.sql`
   - Clique em "Run" ou pressione `Ctrl+Enter`
   - Aguarde a conclusão (pode levar alguns segundos)

   **Passo 2: Funções e triggers**
   - Cole o conteúdo de `002_create_functions_and_triggers.sql`
   - Execute
   - Verifique se não há erros

   **Passo 3: Configurações finais**
   - Cole o conteúdo de `003_create_sample_data.sql`
   - Execute

   **Passo 4: Dados iniciais (opcional)**
   - Se quiser dados de exemplo, descomente as seções em `seed.sql`
   - Execute apenas se for ambiente de desenvolvimento

### Método 2: CLI do Supabase

1. **Certifique-se que o CLI está configurado**
   ```bash
   npx supabase login
   npx supabase link --project-ref jmqjmazlytblitipdrmf
   ```

2. **Execute as migrations**
   ```bash
   npx supabase db push
   ```

## 📊 Estrutura do Banco Criada

### Tabelas Principais

| Tabela | Descrição | Registros Exemplo |
|--------|-----------|------------------|
| `profiles` | Perfis de usuários complementando auth.users | Informações do usuário |
| `imported_files` | Controle de arquivos Excel/CSV importados | Metadata dos arquivos |
| `banking_transactions` | Transações bancárias extraídas | Dados das transações |
| `cash_conference` | Registros de conferência realizados | Itens conferidos |
| `not_found_history` | Valores pesquisados mas não encontrados | Histórico de buscas |
| `work_sessions` | Sessões de trabalho diárias | Estatísticas por dia |

### Funções Disponíveis

| Função | Uso | Exemplo |
|--------|-----|---------|
| `search_transactions_by_value()` | Busca transações por valor | `SELECT * FROM search_transactions_by_value(user_id, 150.00)` |
| `transfer_to_conference()` | Move transação para conferência | `SELECT transfer_to_conference(user_id, transaction_id)` |
| `remove_from_conference()` | Remove item da conferência | `SELECT remove_from_conference(user_id, conference_id)` |
| `get_user_stats()` | Estatísticas do usuário | `SELECT get_user_stats(user_id)` |
| `restart_work_day()` | Reinicia dia de trabalho | `SELECT restart_work_day(user_id)` |

### Views Úteis

| View | Descrição |
|------|-----------|
| `v_active_conferences` | Conferências ativas com detalhes do usuário |
| `v_pending_transactions` | Transações pendentes de conferência |
| `v_daily_stats` | Estatísticas diárias por usuário |

## 🔐 Segurança (RLS)

Todas as tabelas têm **Row Level Security** habilitado:
- Usuários só acessam seus próprios dados
- Políticas específicas para cada operação (SELECT, INSERT, UPDATE, DELETE)
- Funções com `SECURITY DEFINER` para operações controladas

## ✅ Verificação da Instalação

Execute estas consultas para verificar se tudo foi criado corretamente:

```sql
-- Verificar tabelas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'banking_transactions', 'cash_conference');

-- Verificar funções
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%transaction%';

-- Verificar RLS
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```

## 🔧 Configuração da Aplicação

Após importar o schema, configure seu cliente JavaScript:

```javascript
// supabase-client.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL, // https://jmqjmazlytblitipdrmf.supabase.co
  process.env.SUPABASE_ANON_KEY
)

// Exemplo de uso das funções criadas
const searchTransactions = async (userId, value) => {
  const { data, error } = await supabase.rpc('search_transactions_by_value', {
    p_user_id: userId,
    p_value: value
  })
  return { data, error }
}
```

## 🚨 Troubleshooting

### Erro: "permission denied for schema public"
- Verifique se está logado como proprietário do projeto
- Certifique-se que está usando o projeto correto

### Erro: "function already exists"
- Adicione `OR REPLACE` nas funções ou execute `DROP FUNCTION` antes

### Erro: "table already exists"
- Adicione `IF NOT EXISTS` nas tabelas
- Ou execute `DROP TABLE` se quiser recriar

### Performance lenta
- Execute `ANALYZE` após importar dados grandes:
  ```sql
  ANALYZE;
  ```

## 📝 Próximos Passos

1. **Teste a integração** com sua aplicação React
2. **Configure autenticação** via Supabase Auth
3. **Implemente as funções** no frontend
4. **Execute testes** de performance com dados reais
5. **Configure backup** automático dos dados

## 💡 Dicas Importantes

- ✅ **Sempre execute em ordem**: 001 → 002 → 003
- ✅ **Teste em ambiente de desenvolvimento** primeiro
- ✅ **Faça backup** antes de executar em produção
- ✅ **Monitore logs** durante a execução
- ✅ **Valide dados** após importação

---

🎉 **Parabéns!** Seu sistema de conferência de caixa está pronto para uso com Supabase!