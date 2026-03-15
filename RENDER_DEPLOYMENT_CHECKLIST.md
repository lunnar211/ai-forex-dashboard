# Render Deployment Checklist

This checklist ensures your AI Forex Dashboard is properly configured on Render.com

## Pre-Deployment

- [ ] Fork the repository to your GitHub account
- [ ] Have your API keys ready:
  - [ ] At least one AI provider key (Groq, OpenAI, Gemini, or OpenRouter)
  - [ ] Twelve Data API key (optional, uses mock data without it)

## Initial Deployment

### 1. Deploy via Blueprint

- [ ] Go to https://dashboard.render.com/blueprints
- [ ] Click **New Blueprint Instance**
- [ ] Connect your GitHub repository
- [ ] Render auto-detects `render.yaml`
- [ ] Fill in required environment variables when prompted
- [ ] Click **Apply** to create all services

### 2. Services Created

After blueprint deployment, verify these services exist:

- [ ] **ai-forex-backend** (Web Service)
- [ ] **ai-forex-frontend** (Web Service)
- [ ] **forex-redis** (Redis)
- [ ] **forex-db** (PostgreSQL Database)

## Post-Deployment Configuration

### 3. Configure Backend Environment Variables

Go to **ai-forex-backend** service → **Environment**

#### Required Variables (Must Set)

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

#### Auto-Generated Variables (Already Set)

- [ ] `DATABASE_URL` - Auto-linked to postgres database
- [ ] `REDIS_URL` - Auto-linked to Redis instance
- [ ] `JWT_SECRET` - Auto-generated secure secret
- [ ] `CORS_ORIGIN` - Auto-linked to frontend URL

### 4. Restart Backend Service

After setting environment variables:

- [ ] Click **Manual Deploy** → **Deploy latest commit**
- [ ] Or use **Restart** button
- [ ] Wait 2-3 minutes for deployment to complete

### 5. Verify Backend Logs

Go to **ai-forex-backend** → **Logs**

Look for these success messages:

- [ ] `[ENV] Environment validation passed.`
- [ ] `[DB] PostgreSQL connected.`
- [ ] `[DB] Schema initialised.`
- [ ] `[DB] Admin user seeded.` OR `[DB] Admin user already exists — verified admin flag.`
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
- Try wrapping password in single quotes: `'Mac@2019$$'`
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
