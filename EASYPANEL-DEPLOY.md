faz# EasyPanel Deployment Guide

Este guia mostra como fazer o deploy do sistema de Conferência Bancária no EasyPanel.

## 🚀 Pré-requisitos

- Conta no EasyPanel
- Repositório Git com o código
- Credenciais do Supabase configuradas

## 📦 Arquivos de Deploy

Os seguintes arquivos foram criados para o deployment:

- `Dockerfile` - Container configuration
- `docker-compose.yml` - Multi-container setup
- `.env.production` - Production environment template

## ⚙️ Configuração no EasyPanel

### 1. Criar Novo App

1. Acesse o dashboard do EasyPanel
2. Clique em "Create App"
3. Selecione "Docker" como tipo de aplicação

### 2. Configurar o Repositório

- **Repository URL**: Seu repositório Git
- **Branch**: `main`
- **Build Context**: `/` (root)
- **Dockerfile**: `Dockerfile`

### 3. Configurar Variáveis de Ambiente

Configure estas variáveis no EasyPanel:

#### Supabase (Obrigatório)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

#### Configuração da Aplicação
```env
NODE_ENV=production
VITE_DATABASE_MODE=supabase
VITE_ORG_NAME=sua_organizacao
VITE_PROJECT_NAME=conferencia_bancaria
```

#### Configurações de Segurança
```env
VITE_SESSION_TIMEOUT=86400
VITE_MAX_FILE_SIZE=10485760
VITE_ENABLE_AUDIT_LOGGING=true
VITE_FORCE_HTTPS=true
VITE_SECURE_COOKIES=true
```

#### Feature Flags
```env
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_EXPORT_FEATURES=true
VITE_ENABLE_ADVANCED_SEARCH=true
```

### 4. Configurar Porta e Domínio

- **Port**: 3000
- **Domain**: Configure seu domínio personalizado
- **SSL**: Ativar certificado SSL automático

### 5. Deploy e Monitoramento

1. Clique em "Deploy"
2. Monitore os logs durante o build
3. Verifique o health check após o deploy

## 🔧 Build Process

O Dockerfile utiliza multi-stage build:

1. **Builder Stage**: Instala dependências e compila o projeto
2. **Production Stage**: Cria imagem otimizada com apenas os arquivos necessários

## 📊 Monitoramento

### Health Check
- URL: `http://seu-dominio/`
- Intervalo: 30 segundos
- Timeout: 10 segundos

### Logs
- Acesse os logs através do dashboard do EasyPanel
- Monitore performance e erros

## 🛠️ Comandos Úteis

### Build Local para Teste
```bash
# Build da imagem Docker
docker build -t conferencia-bancaria .

# Executar localmente
docker run -p 3000:3000 --env-file .env.production conferencia-bancaria

# Com docker-compose
docker-compose up --build
```

### Deploy Manual
```bash
# Build e deploy
git push origin main
```

## 🔒 Segurança

### Variáveis Sensíveis
- Nunca commitar arquivos `.env` reais
- Usar apenas variáveis `VITE_` no frontend
- Configurar HTTPS obrigatório

### Headers de Segurança
- HTTPS enforcement
- Secure cookies
- Content Security Policy

## 📝 Troubleshooting

### Problemas Comuns

#### Build Failed
- Verifique se todas as dependências estão no `package.json`
- Confirme que o Node.js version está correto (>=18)

#### App não inicia
- Verifique se as variáveis de ambiente estão configuradas
- Confirme se a porta 3000 está exposta

#### Erros de Conexão com Supabase
- Valide URL e keys do Supabase
- Verifique se o projeto Supabase está ativo

### Logs de Debug
```bash
# Ver logs do container
docker logs container_name

# Health check manual
wget --spider http://localhost:3000/
```

## 📚 Recursos Adicionais

- [EasyPanel Documentation](https://easypanel.io/docs)
- [Docker Best Practices](https://docs.docker.com/develop/best-practices/)
- [Supabase Documentation](https://supabase.com/docs)

## ✅ Checklist de Deploy

- [ ] Repositório configurado no EasyPanel
- [ ] Variáveis de ambiente configuradas
- [ ] Supabase projeto ativo e configurado
- [ ] Domínio e SSL configurados
- [ ] Build executado com sucesso
- [ ] Health check passando
- [ ] Logs sem erros críticos
- [ ] Funcionalidades testadas em produção

## 🚨 Backup e Segurança

### Backup dos Dados
- Backup automático do Supabase
- Export regular dos dados críticos

### Monitoramento
- Configurar alertas para downtime
- Monitorar uso de recursos
- Logs de auditoria ativados