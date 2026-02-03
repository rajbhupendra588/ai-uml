# Render — Environment Variables (backend)

Set these in **Render** → your service → **Environment** → **Add Environment Variable**.

Use **Secret** for keys (OPENROUTER_API_KEY, SECRET_KEY, etc.).

---

## Required (production + servicesasai.com)

| Key | Value | Secret? |
|-----|--------|--------|
| `ENVIRONMENT` | `production` | No |
| `CORS_ORIGINS` | `https://servicesasai.com,https://www.servicesasai.com` | No |
| `FRONTEND_URL` | `https://servicesasai.com` | No |
| `API_BASE_URL` | `https://api.servicesasai.com` | No |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` *(your key from openrouter.ai)* | **Yes** |
| `SECRET_KEY` | *(long random string, e.g. from `openssl rand -base64 32`)* | **Yes** |

---

## Optional

| Key | Value | Secret? |
|-----|--------|--------|
| `LOG_LEVEL` | `INFO` | No |
| `MAX_PROMPT_LENGTH` | `2000` | No |
| `OPENAI_API_KEY` | `sk-...` *(if using OpenAI instead of OpenRouter)* | **Yes** |
| `GITHUB_CLIENT_ID` | *(from GitHub OAuth App)* | **Yes** |
| `GITHUB_CLIENT_SECRET` | *(from GitHub OAuth App)* | **Yes** |

---

## Copy-paste (fill in the secrets)

```
ENVIRONMENT=production
CORS_ORIGINS=https://servicesasai.com,https://www.servicesasai.com
FRONTEND_URL=https://servicesasai.com
API_BASE_URL=https://api.servicesasai.com
OPENROUTER_API_KEY=<your-openrouter-key>
SECRET_KEY=<generate-with-openssl-rand-base64-32>
```

---

**Note:** Until you add custom domain `api.servicesasai.com` in Render, you can set `API_BASE_URL` to your Render URL (e.g. `https://ai-uml-api.onrender.com`). Update it to `https://api.servicesasai.com` after DNS is set.
