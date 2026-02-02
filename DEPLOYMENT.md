# Deploying AI-UML to Your GoDaddy Domain

Your app has two parts:
- **Frontend**: Next.js (port 3000)
- **Backend**: FastAPI (port 8000)

GoDaddy sells domains and hosting. For this stack, the best approach is to **use GoDaddy for the domain** and host the app on services that support Node.js and Python.

---

## Option 1: Recommended — Domain on GoDaddy, App Hosted Elsewhere

### Step 1: Host the application

| Service | Frontend (Next.js) | Backend (FastAPI) |
|---------|--------------------|-------------------|
| **Vercel** | ✅ Free tier | — |
| **Railway** | ✅ | ✅ |
| **Render** | ✅ | ✅ |
| **Fly.io** | ✅ | ✅ |

**Example setup:**

1. **Frontend on Vercel** (free)
   - Connect your GitHub repo
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `.next`
   - Add env var: `NEXT_PUBLIC_API_URL=https://your-api.example.com`

2. **Backend on Railway or Render**
   - Deploy the `backend` folder
   - Set env vars: `OPENROUTER_API_KEY`, `CORS_ORIGINS`, `FRONTEND_URL`, etc.
   - Note the backend URL (e.g. `https://your-app-api.up.railway.app`)

### Step 2: Point your GoDaddy domain

1. Log in to **GoDaddy** → **My Products** → **Domains**
2. Click your domain → **Manage DNS**
3. Add/update records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **A** | `@` | Vercel IP (or your host’s IP) | 600 |
| **CNAME** | `www` | `cname.vercel-dns.com` (if using Vercel) | 600 |
| **CNAME** | `api` | `your-backend.up.railway.app` (or your backend host) | 600 |

4. In **Vercel** (or your frontend host), add your domain in project settings.
5. In **Railway/Render**, add `api.yourdomain.com` as a custom domain if supported.

### Step 3: Environment variables

**Frontend** (Vercel):

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Backend** (Railway/Render):

```
ENVIRONMENT=production
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://api.yourdomain.com
OPENROUTER_API_KEY=sk-or-v1-...
SECRET_KEY=<generate-a-secure-random-string>
```

---

## Option 2: GoDaddy VPS (Full control)

If you have or buy a GoDaddy VPS:

1. **SSH into the server**
2. **Install Docker** and Docker Compose
3. **Create a `docker-compose.yml`** (see below)
4. **Install Nginx** as reverse proxy
5. **Point your domain** to the VPS IP via GoDaddy DNS

### Example Docker setup

Create `docker-compose.yml` in your project root:

```yaml
version: "3.8"
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
    restart: unless-stopped

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
      - CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
      - FRONTEND_URL=https://yourdomain.com
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - SECRET_KEY=${SECRET_KEY}
    restart: unless-stopped
```

### Nginx config (reverse proxy + SSL)

```nginx
# /etc/nginx/sites-available/yourdomain
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use **Certbot** for free SSL: `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com`

---

## Option 3: GoDaddy Shared Hosting (cPanel)

GoDaddy shared hosting is mainly for PHP/static sites. It does **not** support:
- Long-running Node.js
- Python/FastAPI

So this option is **not suitable** for your app. Use Option 1 or 2 instead.

---

## Quick checklist

- [ ] Deploy frontend (Vercel/Railway/Render)
- [ ] Deploy backend (Railway/Render/Fly.io)
- [ ] Set `NEXT_PUBLIC_API_URL` to your backend URL
- [ ] Set `CORS_ORIGINS` and `FRONTEND_URL` on backend
- [ ] Add domain in hosting provider
- [ ] Update GoDaddy DNS (A/CNAME records)
- [ ] Wait for DNS propagation (up to 48 hours)
- [ ] Test `https://yourdomain.com` and `https://api.yourdomain.com`

---

## GitHub OAuth (optional)

If you use GitHub login:

1. In GitHub: **Settings → Developer settings → OAuth Apps** → New OAuth App
2. Homepage URL: `https://yourdomain.com`
3. Callback URL: `https://yourdomain.com` (or your auth callback path)
4. Add to backend env: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
