# Deploy de Produção - Cais Teams (Hostinger)

Este guia configura o Cais Teams em **um único subdomínio**:

- URL pública: `https://teams.caishub.com.br`
- Frontend (Next.js): `127.0.0.1:3016`
- Backend (Express): `127.0.0.1:3017`
- API pública: `https://teams.caishub.com.br/api`
- API interna do backend: `/api/v1`
- Uploads públicos: `https://teams.caishub.com.br/uploads/...`

## 1) Variáveis de ambiente

### Root (`.env`) e/ou Backend (`backend/.env`)

```dotenv
PORT=3017
NODE_ENV=production
CORS_ORIGIN=https://teams.caishub.com.br
FRONTEND_APP_URL=https://teams.caishub.com.br
```

### Frontend (`frontend/.env`)

```dotenv
NEXT_PUBLIC_API_URL=https://teams.caishub.com.br/api
NEXT_PUBLIC_MAX_FILE_SIZE_MB=200
```

Observação:
- Em produção, não usar `localhost` no `NEXT_PUBLIC_API_URL`.

## 2) PM2

No diretório raiz do projeto:

```bash
# Backend (Express)
pm2 start npm --name cais-teams-backend -- run start --workspace backend

# Frontend (Next.js)
PORT=3016 pm2 start npm --name cais-teams-frontend -- run start --workspace frontend

# Persistir no boot
pm2 save
pm2 startup
```

Comandos úteis:

```bash
pm2 status
pm2 logs cais-teams-backend
pm2 logs cais-teams-frontend
pm2 restart cais-teams-backend cais-teams-frontend
```

## 3) Nginx (domínio único com `/api` e `/uploads`)

Arquivo sugerido: `/etc/nginx/sites-available/teams.caishub.com.br`

```nginx
server {
  listen 80;
  server_name teams.caishub.com.br;

  location /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

server {
  listen 443 ssl http2;
  server_name teams.caishub.com.br;

  ssl_certificate /etc/letsencrypt/live/teams.caishub.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/teams.caishub.com.br/privkey.pem;

  client_max_body_size 220M;

  # API pública /api -> backend interno /api/v1
  location = /api {
    return 301 /api/;
  }

  location ^~ /api/ {
    rewrite ^/api/(.*)$ /api/v1/$1 break;

    proxy_pass http://127.0.0.1:3017;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
  }

  # Uploads públicos
  location ^~ /uploads/ {
    proxy_pass http://127.0.0.1:3017/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
  }

  # Frontend Next.js
  location / {
    proxy_pass http://127.0.0.1:3016;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Ativar site e validar:

```bash
sudo ln -s /etc/nginx/sites-available/teams.caishub.com.br /etc/nginx/sites-enabled/teams.caishub.com.br
sudo nginx -t
sudo systemctl reload nginx
```

## 4) Certbot

Emitir/instalar certificado SSL:

```bash
sudo certbot --nginx -d teams.caishub.com.br
```

Teste de renovação automática:

```bash
sudo certbot renew --dry-run
```

## 5) Validação da aplicação

Rodar no projeto:

```bash
npm run lint --workspace backend
npm run build --workspace backend
npm run lint --workspace frontend
npm run build --workspace frontend
```

Checks HTTP esperados:

```bash
curl -I https://teams.caishub.com.br
curl -I https://teams.caishub.com.br/api/health
curl -I https://teams.caishub.com.br/uploads/
```

Resultados esperados:
- Frontend responde em `https://teams.caishub.com.br`
- API responde em `https://teams.caishub.com.br/api/*`
- Backend continua internamente em `/api/v1/*`
- Arquivos uploadados ficam acessíveis em `https://teams.caishub.com.br/uploads/...`
