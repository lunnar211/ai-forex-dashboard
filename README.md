# AI Forex Dashboard

A full-stack AI-powered forex trading dashboard with real-time price charts, technical indicators, and multi-provider AI predictions (Groq / OpenAI / Gemini).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lunnar211/ai-forex-dashboard)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Cache | Redis (optional) |
| AI | Groq, OpenAI, Google Gemini |
| Forex data | Twelve Data API (falls back to mock data) |

---

## Deploying to Production

### Option A – One-click on Render.com (recommended for free hosting)

Render gives you a free PostgreSQL database, free Redis instance, and two free web services.

1. Fork this repository to your own GitHub account.
2. Go to <https://dashboard.render.com/blueprints> and click **New Blueprint Instance**.
3. Connect your GitHub repo – Render detects `render.yaml` automatically.
4. Fill in the required environment variables when prompted (see table below).
5. Click **Apply** – Render will create the database, Redis, backend, and frontend in one go.

> After the first deploy, open the backend service in the Render dashboard and add your API keys
> under **Environment → Add Environment Variable**.

---

### Option B – Docker Compose (self-hosted / VPS)

**Prerequisites:** Docker ≥ 24 and Docker Compose v2.

```bash
# 1. Clone the repo
git clone https://github.com/lunnar211/ai-forex-dashboard.git
cd ai-forex-dashboard

# 2. Create a root .env file with your secrets
cat > .env <<'EOF'
JWT_SECRET=replace-with-a-long-random-string
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=
GEMINI_API_KEY=
TWELVE_DATA_API_KEY=
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000
EOF

# 3. Build and start everything
docker compose up --build -d

# 4. Open the app
open http://localhost:3000
```

Stop with `docker compose down`. Data is persisted in the `postgres_data` Docker volume.

---

### Option C – Manual / local development

**Prerequisites:** Node.js ≥ 20, PostgreSQL ≥ 14, (optional) Redis.

```bash
# ── Backend ──────────────────────────────────────────────
cd backend
cp .env.example .env          # then fill in the values
npm install
npm run dev                   # starts on http://localhost:5000

# ── Frontend (new terminal) ───────────────────────────────
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL if needed
npm install
npm run dev                   # starts on http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret used to sign JWT tokens |
| `GROQ_API_KEY` | ⚠️ one required | Groq AI provider key |
| `OPENAI_API_KEY` | ⚠️ one required | OpenAI provider key |
| `GEMINI_API_KEY` | ⚠️ one required | Google Gemini provider key |
| `TWELVE_DATA_API_KEY` | optional | Real-time forex data; uses mock data if unset |
| `REDIS_URL` | optional | Redis connection URL; caching disabled if unset |
| `CORS_ORIGIN` | optional | Allowed CORS origin(s); defaults to `*` |
| `PORT` | optional | Server port; defaults to `5000` |
| `NODE_ENV` | optional | Set to `production` in live environments |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | optional | Backend API URL; defaults to `http://localhost:5000` |

---

## CI / CD

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to `main`:

- **Backend job** – installs Node.js dependencies and checks for syntax errors.
- **Frontend job** – installs dependencies, runs ESLint, and builds the Next.js app.

---

## Project Structure

```
ai-forex-dashboard/
├── backend/               Node.js / Express API
│   ├── src/
│   │   ├── config/        Database & env validation
│   │   ├── controllers/   Route handlers
│   │   ├── routes/        Express routers (auth, forex, ai)
│   │   ├── services/      AI providers & indicator logic
│   │   └── index.js       App entry point
│   ├── Dockerfile
│   └── .env.example
├── frontend/              Next.js 14 app
│   ├── src/
│   │   ├── components/    Chart, Sidebar, SignalPanel …
│   │   ├── pages/         Next.js pages (login, dashboard …)
│   │   ├── services/      Axios API client
│   │   └── store/         Zustand auth store
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml     Full-stack Docker Compose
├── render.yaml            Render.com Blueprint
└── .github/workflows/
    └── ci.yml             GitHub Actions CI
```
