# 🚀 Deploy VPS - Manipularium

Este diretório contém todos os arquivos necessários para fazer deploy da aplicação Manipularium em um servidor VPS próprio.

## 📋 Pré-requisitos

- VPS com Ubuntu 20.04+ ou CentOS 8+
- Acesso SSH ao servidor
- Domínio apontando para o IP do VPS
- Certificado SSL (Let's Encrypt recomendado)

## 📁 Estrutura dos Arquivos

```
deploy-vps/
├── dist/                    # Arquivos buildados da aplicação
├── nginx.conf              # Configuração do Nginx
├── docker-compose.yml      # Orquestração dos containers
├── Dockerfile              # Imagem Docker personalizada
├── deploy.sh               # Script automatizado de deploy
├── .env.production         # Variáveis de ambiente
└── README-DEPLOY.md        # Este arquivo
```

## 🚀 Deploy Automatizado (Recomendado)

### 1. Enviar arquivos para o VPS

```bash
# No seu computador local
scp -r deploy-vps/ usuario@ip-do-vps:/home/usuario/manipularium/

# OU usando rsync
rsync -avz deploy-vps/ usuario@ip-do-vps:/home/usuario/manipularium/
```

### 2. Conectar ao VPS e executar o deploy

```bash
# Conectar ao VPS
ssh usuario@ip-do-vps

# Ir para o diretório
cd /home/usuario/manipularium

# Tornar o script executável e rodar
chmod +x deploy.sh
./deploy.sh
```

## ⚙️ Deploy Manual

### 1. Instalar Docker e Docker Compose

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reiniciar sessão
logout
```

### 2. Configurar aplicação

```bash
# Editar configuração do Nginx
nano nginx.conf
# Alterar 'seu-dominio.com' para o seu domínio real

# Configurar variáveis de ambiente
cp .env.production .env
nano .env
# Configurar URLs e chaves do Supabase
```

### 3. Configurar SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot

# Obter certificado SSL
sudo certbot certonly --standalone -d seu-dominio.com

# Criar diretório SSL
mkdir ssl

# Copiar certificados
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem ssl/certificate.crt
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem ssl/private.key
sudo chown $USER:$USER ssl/*

# Editar nginx.conf para usar os certificados corretos
nano nginx.conf
# Alterar caminhos dos certificados para:
# ssl_certificate /etc/ssl/certs/certificate.crt;
# ssl_certificate_key /etc/ssl/certs/private.key;
```

### 4. Iniciar aplicação

```bash
# Construir e iniciar
docker-compose build
docker-compose up -d

# Verificar status
docker-compose ps
```

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
docker-compose logs -f

# Parar aplicação
docker-compose down

# Reiniciar aplicação
docker-compose restart

# Atualizar aplicação
docker-compose down
docker-compose build
docker-compose up -d

# Verificar uso de recursos
docker stats

# Backup da aplicação
tar -czf backup-manipularium-$(date +%Y%m%d).tar.gz dist/
```

## 🔒 Configurações de Segurança

### Firewall (UFW)

```bash
# Habilitar firewall
sudo ufw enable

# Permitir SSH
sudo ufw allow ssh

# Permitir HTTP e HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Verificar status
sudo ufw status
```

### Renovação automática SSL

```bash
# Adicionar cron job para renovação
sudo crontab -e

# Adicionar linha:
0 2 * * * certbot renew --quiet && docker-compose restart nginx
```

## 📊 Monitoramento

### Logs do Nginx

```bash
# Logs de acesso
sudo tail -f /var/log/nginx/manipularium_access.log

# Logs de erro
sudo tail -f /var/log/nginx/manipularium_error.log
```

### Métricas do Sistema

```bash
# Uso de CPU e memória
htop

# Uso de disco
df -h

# Uso de rede
iftop
```

## 🆘 Solução de Problemas

### Aplicação não carrega

1. Verificar se containers estão rodando:
   ```bash
   docker-compose ps
   ```

2. Verificar logs:
   ```bash
   docker-compose logs nginx
   ```

3. Testar conexão local:
   ```bash
   curl -I http://localhost
   ```

### SSL não funciona

1. Verificar certificados:
   ```bash
   sudo certbot certificates
   ```

2. Testar configuração do Nginx:
   ```bash
   docker-compose exec nginx nginx -t
   ```

### Performance lenta

1. Verificar recursos:
   ```bash
   docker stats
   free -h
   ```

2. Otimizar cache do Nginx (já configurado no nginx.conf)

## 📞 Suporte

Se encontrar problemas:

1. Verificar logs detalhados
2. Confirmar configurações de DNS
3. Testar conectividade de rede
4. Verificar permissões de arquivos

## 🔄 Atualizações

Para atualizar a aplicação:

1. Fazer novo build localmente
2. Substituir pasta `dist/`
3. Executar:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```