#!/bin/bash

# Script de deploy automatizado para VPS
# Execute com: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 Iniciando deploy do Manipularium no VPS..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Instalando..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado. Faça logout e login novamente."
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado. Instalando..."
    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose instalado."
fi

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker-compose down || true

# Construir e iniciar os containers
echo "🔨 Construindo containers..."
docker-compose build

echo "🚀 Iniciando aplicação..."
docker-compose up -d

echo "✅ Deploy concluído!"
echo ""
echo "📋 Comandos úteis:"
echo "  Ver logs: docker-compose logs -f"
echo "  Parar: docker-compose down"
echo "  Status: docker-compose ps"
echo ""
echo "🌐 Aplicação disponível em:"
echo "  HTTP: http://localhost"
echo "  HTTPS: https://localhost (após configurar SSL)"
echo ""
echo "⚠️  Não esqueça de:"
echo "  1. Configurar seu domínio no nginx.conf"
echo "  2. Adicionar certificados SSL na pasta ./ssl/"
echo "  3. Configurar firewall para portas 80 e 443"