# Environment variables — Vercel & Render

Copy these into **Vercel** and **Render**. All values below are real (from backend/.env). Rotate secrets if this file is ever committed to a public repo.

---

## Vercel (Frontend)

**Where:** Vercel → Project → **Settings** → **Environment Variables**

| Variable | Value to set | Secret? |
|----------|----------------|--------|
| NEXT_PUBLIC_API_URL | https://ai-uml-api.onrender.com | No |

Use your actual Render backend URL from Render Dashboard. No trailing slash.

---

## Render (Backend)

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
