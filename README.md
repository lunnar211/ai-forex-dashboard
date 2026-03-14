# AI Forex Dashboard

A full-stack AI-powered forex analytics dashboard with a Node.js/Express backend and a Next.js frontend.

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [GitHub Secrets Setup (Recommended)](#github-secrets-setup-recommended)
- [CI / CD](#ci--cd)

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in the values.

| Variable             | Required | Description                                              |
|----------------------|----------|----------------------------------------------------------|
| `DATABASE_URL`       | ✅        | PostgreSQL connection string                             |
| `JWT_SECRET`         | ✅        | Long random string used to sign JWT tokens               |
| `GROQ_API_KEY`       | ⚠️ one of | Groq AI API key                                          |
| `OPENAI_API_KEY`     | ⚠️ one of | OpenAI API key                                           |
| `GEMINI_API_KEY`     | ⚠️ one of | Google Gemini API key                                    |
| `TWELVE_DATA_API_KEY`| optional | Twelve Data forex API key (falls back to mock data)      |
| `REDIS_URL`          | optional | Redis connection URL (caching disabled if not set)       |
| `CORS_ORIGIN`        | optional | Allowed CORS origin (defaults to `*`)                    |
| `PORT`               | optional | Server port (defaults to `5000`)                         |
| `NODE_ENV`           | optional | `development` or `production`                            |

⚠️ At least **one** AI provider key (`GROQ_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`) is required.

### Frontend (`frontend/.env.local`)

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the values.

| Variable              | Required | Description                        |
|-----------------------|----------|------------------------------------|
| `NEXT_PUBLIC_API_URL` | optional | Backend API URL (default: `http://localhost:5000`) |

---

## Local Development

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your real values
cd backend && npm install && npm run dev

# Frontend (in a separate terminal)
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your real values
cd frontend && npm install && npm run dev
```

---

## GitHub Secrets Setup (Recommended)

> **Never commit real API keys to the repository.**  
> GitHub Secrets are encrypted, invisible in logs, and automatically available to GitHub Actions.

### Step 1 — Open the Secrets page

Navigate to:

```
https://github.com/<your-username>/ai-forex-dashboard/settings/secrets/actions
```

Or: **Repository → Settings → Secrets and variables → Actions**

### Step 2 — Add each secret

Click **"New repository secret"** and add one secret at a time:

| Secret Name            | Where to get the value                                                    |
|------------------------|---------------------------------------------------------------------------|
| `DATABASE_URL`         | Your PostgreSQL provider (e.g. Supabase, Railway, Neon, ElephantSQL)      |
| `JWT_SECRET`           | Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `GROQ_API_KEY`         | [console.groq.com/keys](https://console.groq.com/keys)                    |
| `OPENAI_API_KEY`       | [platform.openai.com/api-keys](https://platform.openai.com/api-keys)      |
| `GEMINI_API_KEY`       | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)  |
| `TWELVE_DATA_API_KEY`  | [twelvedata.com](https://twelvedata.com/) (free tier available)            |
| `REDIS_URL`            | Your Redis provider (e.g. Upstash, Railway)                               |
| `CORS_ORIGIN`          | Your frontend URL in production (e.g. `https://my-forex-app.vercel.app`)  |
| `NEXT_PUBLIC_API_URL`  | Your backend URL in production (e.g. `https://my-forex-api.railway.app`)  |

### Step 3 — Push and deploy

Once the secrets are added, push a commit to `main`/`master`.  
GitHub Actions picks up the secrets automatically and runs the deploy workflow.

### Why GitHub Secrets instead of committing keys?

| Method              | Security     | Access             | Rotation |
|---------------------|--------------|--------------------|----------|
| **GitHub Secrets**  | ✅ Encrypted | Only GitHub Actions | Easy     |
| Hardcoded in code   | ❌ Exposed   | Anyone with repo access | Manual |
| Shared via Drive/link | ❌ Very risky | Anyone with link   | Manual   |

---

## CI / CD

The repository ships with two GitHub Actions workflows:

| Workflow                         | Trigger                     | What it does                        |
|----------------------------------|-----------------------------|-------------------------------------|
| `.github/workflows/ci.yml`       | Push / Pull Request         | Installs deps, lints, builds frontend |
| `.github/workflows/deploy.yml`   | Push to `main`/`master`     | Builds the app and deploys using secrets |

Adapt the **Deploy** steps in `deploy.yml` to match your hosting provider (Railway, Render, Fly.io, Vercel, VPS, etc.).