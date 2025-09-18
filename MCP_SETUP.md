# Supabase MCP (Model Context Protocol) Setup

Este projeto agora inclui o servidor MCP do Supabase, que permite que assistentes de IA interajam diretamente com seu banco de dados Supabase.

## O que foi instalado

- `@supabase/mcp-server-supabase@latest` - Servidor MCP principal
- `@supabase/mcp-utils@latest` - Utilitários para MCP

## Scripts disponíveis

```bash
# Executar servidor MCP em modo somente leitura (recomendado)
npm run mcp:server

# Executar servidor MCP com acesso completo (cuidado!)
npm run mcp:server:full
```

## Configuração para diferentes clientes

### Para Cursor IDE

Adicione ao seu arquivo de configuração do Cursor (`~/.cursor-settings`):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=artgvpolienazfaalwtk"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_af1f38ecb05babaa3c231d7b361c0ea393070238"
      }
    }
  }
}
```

### Para Claude Desktop

Adicione ao arquivo de configuração do Claude Desktop:

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=artgvpolienazfaalwtk"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_af1f38ecb05babaa3c231d7b361c0ea393070238"
      }
    }
  }
}
```

### Para VS Code com Copilot

Configure através das extensões MCP do VS Code ou usando o arquivo `.mcp-config.json` incluído no projeto.

## Funcionalidades disponíveis

Com o MCP configurado, os assistentes de IA podem:

1. **Explorar estrutura do banco**: Ver tabelas, colunas, índices e relacionamentos
2. **Executar consultas SQL**: Fazer queries no banco de dados
3. **Analisar dados**: Estatísticas e insights sobre os dados
4. **Gerar queries**: Criar consultas SQL baseadas em descrições em linguagem natural

## Segurança

⚠️ **IMPORTANTE**:

- **ACESSO COMPLETO HABILITADO** - O MCP pode ler E escrever no banco de dados
- Este projeto está configurado para desenvolvimento com acesso total
- O token de acesso tem permissões completas para todas as operações
- Mantenha o token seguro e não compartilhe publicamente

## Estrutura do banco de dados

O MCP terá acesso às seguintes tabelas principais:

- `profiles` - Perfis de usuário
- `banking_transactions` - Transações bancárias
- `cash_conference` - Conferência de caixa
- `not_found_history` - Histórico de valores não encontrados

## Comandos úteis

```bash
# Testar conexão MCP
npm run mcp:server

# Ver logs do Supabase
npx supabase logs

# Status do projeto Supabase
npx supabase status
```

## Troubleshooting

1. **Erro de autenticação**: Verifique se o `SUPABASE_ACCESS_TOKEN` está correto
2. **Servidor não inicia**: Certifique-se de ter Node.js 22+ instalado
3. **Permissões negadas**: Confirme que o token tem as permissões necessárias

Para mais informações, consulte a [documentação oficial do Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp).