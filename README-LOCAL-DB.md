# Banco de Dados Local para Desenvolvimento

Este projeto inclui configuração para desenvolvimento com banco PostgreSQL local usando Docker.

## Configuração Rápida

### 1. Iniciar o Banco de Dados Local
```bash
npm run db:start
```

### 2. Executar a Aplicação em Modo Local
```bash
npm run dev:local
```

## Scripts Disponíveis

- `npm run db:start` - Inicia o container PostgreSQL
- `npm run db:stop` - Para o container PostgreSQL
- `npm run db:logs` - Visualiza logs do banco de dados
- `npm run db:shell` - Acessa o shell do PostgreSQL
- `npm run dev:local` - Executa a aplicação com configuração local

## Configuração do Banco

### Dados de Conexão
- **Host**: localhost
- **Porta**: 5432
- **Banco**: projetocaixa
- **Usuário**: postgres
- **Senha**: postgres

### Tabelas Criadas Automaticamente
- `users` - Usuários do sistema
- `cash_conferences` - Conferências de caixa
- `cash_conference_items` - Itens das conferências
- `not_found_history` - Histórico de não encontrados

### Usuário de Teste
- **Username**: admin
- **Senha**: admin123

## Estrutura dos Arquivos

```
/
├── docker-compose.yml          # Configuração do Docker
├── database/
│   └── init.sql               # Script de inicialização do banco
├── .env.development           # Configurações para desenvolvimento local
└── README-LOCAL-DB.md         # Este arquivo
```

## Comandos Úteis

### Acessar o Banco Diretamente
```bash
npm run db:shell
```

### Ver Tabelas
```sql
\dt
```

### Ver Dados de Exemplo
```sql
SELECT * FROM users;
SELECT * FROM cash_conferences;
SELECT * FROM cash_conference_items;
```

### Reset do Banco (se necessário)
```bash
npm run db:stop
docker volume rm projetocaixa_postgres_data
npm run db:start
```

## Troubleshooting

### Porto 5432 já em uso
Se você já tem PostgreSQL instalado localmente, pode alterar a porta no `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"  # Use porta 5433 no host
```

E atualizar o `.env.development`:
```
POSTGRES_PORT=5433
```

### Container não inicia
Verifique se o Docker está rodando:
```bash
docker --version
docker info
```

### Logs de erro
```bash
npm run db:logs
```