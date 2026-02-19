# ArchitectAI — Deployment Guide (Vercel + Render)

Deploy **Frontend** on **Vercel** and **Backend** on **Render**. Follow this guide to ship a new version from your local repo.

---

## What to set in Vercel (Frontend)

**Where:** Vercel → Project → **Settings** → **Environment Variables**

| Variable | Value to set | Secret? |
|----------|----------------|--------|
| NEXT_PUBLIC_API_URL | https://ai-uml-api.onrender.com | No |

Use your actual Render backend URL (e.g. from Render Dashboard). No trailing slash.

---

## What to set in Render (Backend)

**Where:** Render → Service → **Environment** (mark Secret? = Yes as **Secret** in Render)

| Variable | Value to set | Secret? |
|----------|----------------|--------|
| ENVIRONMENT | production | No |
| LOG_LEVEL | INFO | No |
| CORS_ORIGINS | https://architect-ai.vercel.app | No |
| RATE_LIMIT_GENERATE | 5/minute | No |
| FRONTEND_URL | https://architect-ai.vercel.app | No |
| API_BASE_URL | https://ai-uml-api.onrender.com | No |
| SECRET_KEY | dev-secret-change-in-production | Yes |
| OPENROUTER_API_KEY | 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 | Yes |
| OPENROUTER_MODEL | arcee-ai/trinity-large-preview:free | No |
| GITHUB_CLIENT_ID | Ov23liaUrnytBWa56joS | No |
| GITHUB_CLIENT_SECRET | 8491ff1f7a528c3abcbb67253705d68f7b9e2595 | Yes |
| GITHUB_CALLBACK_URL | https://architect-ai.vercel.app/auth/callback | No |
| GITHUB_TOKEN | (set in Render from backend/.env) | Yes |
| RAZORPAY_KEY_ID | rzp_live_SEUHD42BXxdJSA | No |
| RAZORPAY_KEY_SECRET | Kx5Jx7La9DnTzhvotS7qb4qw | Yes |
| RAZORPAY_PLAN_PRO_MONTHLY | plan_SFfb3seL0Shqou | No |
| RAZORPAY_PLAN_PRO_ANNUAL | plan_SFfbWympEf9AmV | No |
| RAZORPAY_WEBHOOK_SECRET | architectai_webhook_secret_123 | Yes |
| SUPABASE_DATABASE_URL | postgresql+asyncpg://postgres.nkcjuwoltqcvaiutpdkj:Panida2590%21@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres | Yes |

Use your real Vercel and Render URLs if different.

---

## 1. Pre-deploy checklist (local)

- [ ] Run backend locally: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
- [ ] Run frontend: `cd frontend && npm install && npm run build && npm start`
- [ ] Commit and push your new version to your Git branch (e.g. `main`)

---

## 2. Backend — Render

### 2.1 Service type & repo

- **Type:** Web Service  
- **Repository:** Your Git repo (GitHub/GitLab)  
- **Branch:** e.g. `main`  
- **Root directory:** `backend`

### 2.2 Build & start

| Setting        | Value |
|----------------|--------|
| **Runtime**    | Python 3 |
| **Build Command** | `pip install --upgrade pip setuptools && pip install -r requirements.txt` |
| **Start Command** | `python -m uvicorn main:app --host 0.0.0.0 --port $PORT` |

Render sets `PORT` automatically; the app already uses it.

**Note:** The build command upgrades `setuptools` (needed by Razorpay for `pkg_resources` on Python 3.12+). The start command uses `python -m uvicorn` so the same environment that received `pip install` is used at runtime, avoiding `ModuleNotFoundError: No module named 'pkg_resources'`.

### 2.3 Backend environment variables (Render Dashboard → Environment)

Use the **What to set in Render (Backend)** table at the top of this guide. Mark Secret? = Yes as **Secret** in Render.

### 2.4 Deploy new version (backend)

1. Push to `main` (or the branch connected to Render).  
2. Render will auto-deploy, or use **Manual Deploy** in the Dashboard.  
3. Check **Logs** for build/start errors.

---

## 3. Frontend — Vercel

### 3.1 Project & repo

- **Framework Preset:** Next.js (Vercel will detect it).  
- **Repository:** Same Git repo.  
- **Root directory:** `frontend`

### 3.2 Build & output

| Setting | Value |
|--------|--------|
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` or leave default |
| **Output Directory** | (Next.js default; leave empty) |
| **Install Command** | `npm install` or leave default |

### 3.3 Frontend environment variables (Vercel Dashboard → Settings → Environment Variables)

Use the **What to set in Vercel (Frontend)** table at the top of this guide.

That’s the only env the frontend uses for API; all other config is on the backend.

### 3.4 Deploy new version (frontend)

1. Push to `main` (or the branch connected to Vercel).  
2. Vercel will build and deploy.  
3. Or: **Deployments** → **Redeploy** latest, or trigger from Git.

---

## 4. Post-deploy configuration

### 4.1 CORS (backend)

- In Render, **CORS_ORIGINS** must include your exact Vercel URL(s), e.g.:  
  `https://your-app.vercel.app`  
  If you use a custom domain, add it too (comma-separated, no spaces).

### 4.2 GitHub OAuth (if used)

- GitHub → **Settings** → **Developer settings** → **OAuth Apps** → your app.  
- **Authorization callback URL** must be exactly:  
  `https://your-app.vercel.app/auth/callback`  
  (or your custom domain). No trailing slash.

### 4.3 Razorpay (if used)

- **Dashboard** → **Settings** → **API Keys**: use Live (or Test) keys and set **RAZORPAY_KEY_ID** / **RAZORPAY_KEY_SECRET** in Render.  
- **Subscriptions** → **Plans**: create plans and set **RAZORPAY_PLAN_PRO_MONTHLY** and **RAZORPAY_PLAN_PRO_ANNUAL** in Render.  
- **Webhooks**: add a webhook URL pointing to your backend (e.g. `https://ai-uml-api.onrender.com/api/v1/subscription/webhook`) and set **RAZORPAY_WEBHOOK_SECRET** in Render.

---

## 5. Quick reference — URLs to set

After first deploy, fill in:

| Where | Variable | Value |
|-------|----------|--------|
| **Render** | **FRONTEND_URL** | Your Vercel URL, e.g. `https://architect-ai.vercel.app` |
| **Render** | **API_BASE_URL** | Your Render URL, e.g. `https://ai-uml-api.onrender.com` |
| **Render** | **CORS_ORIGINS** | Same as FRONTEND_URL (add custom domain if any) |
| **Vercel** | **NEXT_PUBLIC_API_URL** | Same as API_BASE_URL, e.g. `https://ai-uml-api.onrender.com` |

---

## 6. Troubleshooting

- **CORS errors in browser:** Ensure **CORS_ORIGINS** in Render exactly matches the origin (scheme + host, no trailing slash).  
- **401 / auth errors:** Check **SECRET_KEY** is set in Render and unchanged between restarts.  
- **API not reachable from frontend:** Check **NEXT_PUBLIC_API_URL** in Vercel and that the backend service on Render is live.  
- **Render free tier spin-down:** First request after idle can be slow; consider upgrading or a health-check pinger.

---

## 7. One-page config summary

**Render (backend)**  
- Build: `pip install -r requirements.txt`  
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`  
- Root: `backend`  
- Must set: `ENVIRONMENT`, `CORS_ORIGINS`, `FRONTEND_URL`, `API_BASE_URL`, `SECRET_KEY`, `OPENROUTER_API_KEY` (+ Razorpay/GitHub/DB if used).

**Vercel (frontend)**  
- Root: `frontend`  
- Build: `npm run build`  
- Must set: `NEXT_PUBLIC_API_URL` = your Render backend URL.

Once these are set, pushing to your connected branch deploys the new version on both platforms.
