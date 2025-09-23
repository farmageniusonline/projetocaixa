# Dockerfile para deploy em VPS
FROM nginx:alpine

# Copiar arquivos da aplicação
COPY dist/ /var/www/manipularium/

# Copiar configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Criar diretório para logs
RUN mkdir -p /var/log/nginx

# Expor portas
EXPOSE 80 443

# Comando para iniciar o Nginx
CMD ["nginx", "-g", "daemon off;"]