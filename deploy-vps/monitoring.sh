#!/bin/bash

# Script de monitoramento para Manipularium
# Execute com: chmod +x monitoring.sh && ./monitoring.sh

echo "📊 MONITORAMENTO - Manipularium"
echo "=================================="
echo ""

# Status dos containers
echo "🐳 STATUS DOS CONTAINERS:"
docker-compose ps
echo ""

# Uso de recursos dos containers
echo "📈 USO DE RECURSOS:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo ""

# Uso do sistema
echo "💻 SISTEMA:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}')% em uso"
echo "Memória: $(free | grep Mem | awk '{printf("%.1f%% usado (%s/%s)\n", $3/$2*100, $3, $2)}')"
echo "Disco: $(df -h / | awk 'NR==2{printf "%s usado (%s disponível)\n", $5, $4}')"
echo ""

# Últimas conexões (últimas 10)
echo "🌐 ÚLTIMAS CONEXÕES:"
if [ -f "/var/log/nginx/manipularium_access.log" ]; then
    tail -n 10 /var/log/nginx/manipularium_access.log | awk '{print $1, $4, $5, $6, $7, $9}' | column -t
else
    echo "Log de acesso não encontrado"
fi
echo ""

# Verificar se a aplicação está respondendo
echo "🔍 TESTE DE CONECTIVIDADE:"
if curl -s -I http://localhost | grep -q "200 OK"; then
    echo "✅ Aplicação respondendo (HTTP)"
else
    echo "❌ Aplicação não está respondendo (HTTP)"
fi

if curl -s -I https://localhost | grep -q "200 OK" 2>/dev/null; then
    echo "✅ Aplicação respondendo (HTTPS)"
else
    echo "⚠️  HTTPS não configurado ou não respondendo"
fi
echo ""

# Verificar certificado SSL
echo "🔒 CERTIFICADO SSL:"
if command -v openssl &> /dev/null; then
    if [ -f "ssl/certificate.crt" ]; then
        EXPIRY=$(openssl x509 -in ssl/certificate.crt -noout -enddate | cut -d= -f2)
        echo "Expira em: $EXPIRY"

        # Verificar se expira em menos de 30 dias
        if openssl x509 -in ssl/certificate.crt -noout -checkend 2592000; then
            echo "✅ Certificado válido por mais de 30 dias"
        else
            echo "⚠️  Certificado expira em menos de 30 dias!"
        fi
    else
        echo "⚠️  Certificado SSL não encontrado"
    fi
else
    echo "OpenSSL não instalado"
fi
echo ""

echo "=================================="
echo "📋 Para mais detalhes:"
echo "  Logs: docker-compose logs -f"
echo "  Logs Nginx: tail -f /var/log/nginx/manipularium_*.log"
echo "  Reiniciar: docker-compose restart"