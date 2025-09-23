#!/bin/bash

# Script de backup para Manipularium
# Execute com: chmod +x backup.sh && ./backup.sh

set -e

echo "💾 Iniciando backup do Manipularium..."

# Definir variáveis
BACKUP_DIR="/home/backups/manipularium"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="manipularium_backup_$DATE"

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

echo "📁 Criando backup em $BACKUP_DIR/$BACKUP_NAME.tar.gz"

# Criar backup dos arquivos da aplicação
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
    --exclude="*.log" \
    --exclude="node_modules" \
    --exclude="*.tmp" \
    dist/ \
    nginx.conf \
    docker-compose.yml \
    .env

# Backup da configuração do Docker
docker-compose config > "$BACKUP_DIR/docker-compose-$DATE.yml"

# Backup dos logs (últimas 1000 linhas)
if [ -f "/var/log/nginx/manipularium_access.log" ]; then
    tail -n 1000 /var/log/nginx/manipularium_access.log > "$BACKUP_DIR/access_log_$DATE.log"
fi

if [ -f "/var/log/nginx/manipularium_error.log" ]; then
    tail -n 1000 /var/log/nginx/manipularium_error.log > "$BACKUP_DIR/error_log_$DATE.log"
fi

# Limpar backups antigos (manter apenas os últimos 7 dias)
find $BACKUP_DIR -name "manipularium_backup_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "docker-compose-*.yml" -mtime +7 -delete
find $BACKUP_DIR -name "*_log_*.log" -mtime +7 -delete

echo "✅ Backup concluído: $BACKUP_NAME.tar.gz"
echo "📊 Tamanho do backup:"
ls -lh "$BACKUP_DIR/$BACKUP_NAME.tar.gz"

echo ""
echo "💡 Para restaurar o backup:"
echo "  cd /path/to/restore"
echo "  tar -xzf $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "  docker-compose up -d"