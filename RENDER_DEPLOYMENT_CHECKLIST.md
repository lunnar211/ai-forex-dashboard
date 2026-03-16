# Render Deployment Checklist

This checklist ensures your AI Forex Dashboard is properly configured on Render.com

## Pre-Deployment

- [ ] Fork the repository to your own GitHub account
- [ ] Have your API keys ready:
  - [ ] At least one AI provider key (Groq, OpenAI, Gemini, or OpenRouter)
  - [ ] Twelve Data API key (optional, uses mock data without it)

## Initial Deployment

### 1. Deploy via Blueprint (Recommended – one click)

The `render.yaml` in the repo auto-provisions PostgreSQL, Redis, backend, and
frontend services. **Service URLs are wired automatically** – you only need to
supply your secrets when prompted.

- [ ] Go to https://dashboard.render.com/blueprints
- [ ] Click **New Blueprint Instance**
- [ ] Connect your GitHub repository (Render auto-detects `render.yaml`)
- [ ] When prompted, fill in the required variables:
  - `ADMIN_EMAIL` – your admin login email
  - `ADMIN_PASSWORD` – your admin password (min 8 chars)
  - At least one of `GROQ_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`
- [ ] Click **Apply** – Render creates all four services automatically

### 2. Services Created

After blueprint deployment, verify these services exist:

- [ ] **ai-forex-backend** (Web Service)
- [ ] **ai-forex-frontend** (Web Service)
- [ ] **forex-redis** (Redis)
- [ ] **forex-db** (PostgreSQL Database)

#### Auto-Wired Variables (No Action Required)

The Blueprint links **all** of these automatically – you do **not** need to copy or
paste any URLs:

| Variable | Set on service | Auto-source |
|---|---|---|
| `DATABASE_URL` | **ai-forex-backend** | Auto-linked to **forex-db** |
| `REDIS_URL` | **ai-forex-backend** | Auto-linked to **forex-redis** |
| `JWT_SECRET` | **ai-forex-backend** | Auto-generated secure secret |
| `CORS_ORIGIN` | **ai-forex-backend** | Auto-set to the **ai-forex-frontend** URL |
| `NEXT_PUBLIC_API_URL` | **ai-forex-frontend** | Auto-set to the **ai-forex-backend** URL |

#### Where your service URLs come from

Render assigns each web service a URL of the form:

```
https://<service-name>.onrender.com
```

With the default service names in `render.yaml` the URLs will be:

| Service | URL |
|---|---|
| **ai-forex-backend** | `https://ai-forex-backend.onrender.com` |
| **ai-forex-frontend** | `https://ai-forex-frontend.onrender.com` |

You can verify the actual URL for any service by:
1. Opening https://dashboard.render.com
2. Clicking the service name
3. The URL is shown at the top of the service page (copy it with the copy icon)

#### What each URL is used for

| Variable | Set on service | Value | Why |
|---|---|---|---|
| `CORS_ORIGIN` | **ai-forex-backend** | Frontend URL (`https://ai-forex-frontend.onrender.com`) | Tells the backend which origin is allowed to call its API |
| `NEXT_PUBLIC_API_URL` | **ai-forex-frontend** | Backend URL (`https://ai-forex-backend.onrender.com`) | Tells the frontend where to send API requests |

> ⚠️ **Important – do NOT swap these.** `CORS_ORIGIN` lives on the *backend* and
> holds the *frontend* URL. `NEXT_PUBLIC_API_URL` lives on the *frontend* and holds
> the *backend* URL.

#### How to check or update a variable in the Render dashboard (if needed)

1. Open https://dashboard.render.com and select the service (backend or frontend).
2. Click the **Environment** tab in the left sidebar.
3. All current environment variables are listed here.
4. To change a value: click the pencil icon next to the variable, update the value,
   then click **Save Changes**.
5. Click **Manual Deploy → Deploy latest commit** to apply the change.

> **Security note:** Never put real API keys or passwords in the GitHub repository.
> Always set secrets directly in the Render dashboard.
> The `.env.example` files in the repo show only placeholder values – they are
> templates to guide you, not files that should contain real credentials.

## Post-Deployment Configuration

### 3. Configure Backend API Keys

Go to **ai-forex-backend** service → **Environment** tab.

#### Required Variables (Prompted During Blueprint Setup)

- [ ] `ADMIN_EMAIL` - Your admin login email

- [ ] `ADMIN_PASSWORD` - Your admin password (min 8 chars)

- [ ] At least ONE AI provider key:
  - [ ] `GROQ_API_KEY` - Get from https://console.groq.com
  - [ ] `OPENAI_API_KEY` - Get from https://platform.openai.com
  - [ ] `GEMINI_API_KEY` - Get from https://makersuite.google.com/app/apikey
  - [ ] `OPENROUTER_API_KEY` - Get from https://openrouter.ai/settings/keys

#### Optional Variables (Recommended)

- [ ] `TWELVE_DATA_API_KEY` - Real forex data (get from https://twelvedata.com)
  - Without this, the app uses realistic mock data
  - Free tier: 800 API calls/day

### 4. Restart Backend Service

After setting environment variables:

- [ ] Click **Manual Deploy** → **Deploy latest commit**
- [ ] Or use **Restart** button
- [ ] Wait 3-5 minutes for Docker image to build and deploy

### 5. Verify Backend Logs

Go to **ai-forex-backend** → **Logs**

Look for these success messages:

- [ ] `[ENV] Environment validation passed.`
- [ ] `[DB] PostgreSQL connected.`
- [ ] `[DB] Schema initialised.`
- [ ] `[DB] Admin user seeded.` OR `[DB] Admin user already exists — verified admin flag.` OR `[DB] Admin user already exists — verified admin flag and synced password.`
- [ ] `[Redis] Connected.` (or warning if not configured)
- [ ] `[Server] AI Forex Backend running on port 5000`

### 6. Test Frontend

- [ ] Visit your frontend URL: `https://ai-forex-frontend.onrender.com`
- [ ] Should see the login page
- [ ] Click **Create free account** to test user registration
- [ ] Create a test user account
- [ ] Verify you can log in with the test account
- [ ] Check that you land on the dashboard

### 7. Test Admin Panel

- [ ] Visit: `https://ai-forex-frontend.onrender.com/admin`
- [ ] Log in with your `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- [ ] Verify you can access the admin dashboard
- [ ] Check that you see:
  - [ ] User list (should see your test user)
  - [ ] Statistics panel
  - [ ] Activity log

### 8. Test AI Predictions

- [ ] Log in as regular user (not admin)
- [ ] Go to Dashboard
- [ ] Select a currency pair (EUR/USD, GBP/USD, etc.)
- [ ] Click **GET AI PREDICTION**
- [ ] Verify you receive a prediction with:
  - [ ] BUY/SELL/HOLD direction
  - [ ] Confidence percentage
  - [ ] Entry price, stop loss, take profit
  - [ ] AI reasoning

## Troubleshooting

### Backend Won't Start

Check logs for errors:

**Error: Missing environment variables**
- Solution: Set all required variables in Environment tab

**Error: Database connection failed**
- Solution: Verify `DATABASE_URL` is set correctly (should be auto-linked)

**Error: Redis connection failed**
- Solution: Verify `REDIS_URL` is set correctly (should be auto-linked)
- Note: Redis is optional, app works without it (just slower)

### Admin Login Fails

**Error: Invalid email or password**
- Verify `ADMIN_EMAIL` exactly matches what you're typing
- Check `ADMIN_PASSWORD` for special characters
- Try wrapping password in single quotes: `'YourAdminPassword123!'`
- Restart backend service after setting variables

**Error: Access denied. Admin privileges required**
- Check backend logs for: `[DB] Admin user seeded.`
- If not present, restart backend service
- Run verification: `npm run verify-admin` (if you have shell access)

### AI Predictions Fail

**Error: No AI provider key configured**
- Set at least one of: `GROQ_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`
- Restart backend service

**AI returns generic responses**
- Verify your API key is valid and has credits
- Check backend logs for API errors

### Charts Show Mock Data Warning

**Not an error** - This is normal if:
- `TWELVE_DATA_API_KEY` is not set
- You've exceeded Twelve Data API rate limits
- The app automatically falls back to realistic mock data

To fix:
- Set `TWELVE_DATA_API_KEY` in backend environment
- Get a free API key from https://twelvedata.com (800 calls/day)

## Performance Optimization

### Enable Redis Caching (Recommended)

Redis is auto-linked in blueprint but should be working. If caching isn't working:

- [ ] Verify `REDIS_URL` is set in backend environment
- [ ] Check redis service is running on Render
- [ ] Check backend logs for `[Redis] Connected.`

Benefits:
- Faster API responses
- Reduces load on Twelve Data API
- Caches forex prices for 60 seconds
- Caches signals for 5 minutes

### Upgrade from Free Tier (Optional)

Free tier limitations:
- Backend & Frontend services spin down after 15 minutes of inactivity
- Cold start takes 30-60 seconds
- 750 hours/month uptime per service

Paid tier benefits ($7/month per service):
- Always-on (no cold starts)
- Faster response times
- More resources (RAM, CPU)

## Security Best Practices

- [ ] Change admin password after first login
- [ ] Never commit API keys to Git
- [ ] Use strong passwords (12+ chars, mixed case, numbers, symbols)
- [ ] Regularly review user activity logs
- [ ] Block suspicious accounts immediately
- [ ] Keep dependencies updated

## Monitoring

### What to Monitor

- [ ] Backend logs for errors
- [ ] Database storage usage (free tier: 1 GB)
- [ ] Redis memory usage (free tier: 25 MB)
- [ ] API rate limits (Twelve Data, AI providers)
- [ ] User activity for suspicious behavior

### Render Dashboard

Regularly check:
- Service health status (green = healthy)
- Build/deploy status
- Resource usage metrics
- Error logs

## Support Resources

- Render Docs: https://render.com/docs
- GitHub Issues: Your repo's Issues tab
- Admin Setup Guide: [ADMIN_SETUP.md](ADMIN_SETUP.md)
- Quick Fix Guide: [QUICK_FIX.md](QUICK_FIX.md)

## Deployment Complete!

Once all checkboxes are complete, your AI Forex Dashboard is fully deployed and operational on Render.com
