# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Please open a GitHub Issue (or contact the repository owner directly) to
report a security vulnerability.  We aim to acknowledge reports within 48 hours
and to provide a fix or mitigation within 7 days for confirmed issues.

---

## Managing Secrets & Environment Variables

**Never commit real credentials or API keys to source control.**

### Local Development

1. Copy the example files and fill in your own values:
   ```bash
   cp backend/.env.example  backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
2. Both `.env` and `.env.local` are listed in `.gitignore` and will never be
   committed automatically.

### Production (Render.com)

Set each variable in the Render dashboard under
**Service → Environment → Environment Variables** for the backend service.
Keys marked `sync: false` in `render.yaml` must be filled in manually.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (auto-set by Render blueprint) |
| `JWT_SECRET` | ✅ | Long random string used to sign auth tokens |
| `ADMIN_EMAIL` | ✅ | Login email for the admin panel |
| `ADMIN_PASSWORD` | ✅ | Login password for the admin panel |
| `GROQ_API_KEY` | ⚠️ at least one AI key | From console.groq.com |
| `OPENAI_API_KEY` | ⚠️ at least one AI key | From platform.openai.com |
| `GEMINI_API_KEY` | ⚠️ at least one AI key | From aistudio.google.com |
| `OPENROUTER_API_KEY` | ⚠️ at least one AI key | From openrouter.ai/settings/keys |
| `TWELVE_DATA_API_KEY` | Optional | From twelvedata.com — falls back to mock data if absent |
| `REDIS_URL` | Optional | Auto-set by Render blueprint |
| `CORS_ORIGIN` | Optional | Auto-set by Render blueprint from frontend URL |

### GitHub Actions / CI

Store secrets in **Settings → Secrets and Variables → Actions** on GitHub.
Never hard-code API keys in workflow files.
