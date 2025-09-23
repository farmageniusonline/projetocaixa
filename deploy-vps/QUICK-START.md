# ⚡ Quick Start - Deploy VPS

## 🚀 Deploy em 5 Minutos

### 1. Enviar para VPS
```bash
scp -r deploy-vps/ usuario@ip-do-vps:/home/usuario/manipularium/
```

### 2. Conectar e Deploy
```bash
ssh usuario@ip-do-vps
cd /home/usuario/manipularium
./deploy.sh
```

### 3. Configurar Domínio
```bash
# Editar nginx.conf
nano nginx.conf
# Alterar 'seu-dominio.com' para seu domínio

# Reiniciar
docker-compose restart
```

### 4. SSL (Let's Encrypt)
```bash
# Instalar certbot
sudo apt install certbot

# Obter certificado
sudo certbot certonly --standalone -d seu-dominio.com

# Configurar certificados
mkdir ssl
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem ssl/certificate.crt
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem ssl/private.key
sudo chown $USER:$USER ssl/*

# Reiniciar com SSL
docker-compose restart
```

## ✅ Verificar

- HTTP: `http://seu-dominio.com`
- HTTPS: `https://seu-dominio.com`
- Status: `docker-compose ps`
- Logs: `docker-compose logs -f`

## 🔧 Comandos Úteis

```bash
# Monitorar
./monitoring.sh

# Backup
./backup.sh

# Parar
docker-compose down

# Atualizar
docker-compose restart
```

## 🆘 Problemas?

1. **Não carrega**: `docker-compose logs nginx`
2. **SSL erro**: Verificar certificados em `ssl/`
3. **Performance**: `docker stats`
4. **Conectividade**: `curl -I http://localhost`

📖 **Documentação completa**: `README-DEPLOY.md`