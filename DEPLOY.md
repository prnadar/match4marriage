# Bandhan — Deployment Guide

## ✅ Frontend — Live Now

**URL:** https://frontend-black-psi-12.vercel.app

Share this with clients. All pages are live:
- `/` — Landing page with Kundali section
- `/kundali-match` — Free public Kundali matching
- `/auth/login` `/auth/register` — Auth flows
- `/dashboard` `/matches` `/interests` `/messages` — Core app
- `/kundali` `/nri-hub` `/family` — Feature pages
- `/settings` `/notifications` `/subscription` — Account pages
- `/pricing` — Pricing page

To redeploy after changes:
```bash
cd bandhan/frontend
vercel deploy --prod
```

---

## 🚀 Backend — Deploy to Railway (5 min)

### Step 1 — Login to Railway
```bash
railway login
```
(opens browser — sign in with GitHub)

### Step 2 — Create project & deploy
```bash
cd bandhan/backend
railway init          # create new project named "bandhan-api"
railway add --plugin postgresql   # adds a free Postgres DB
railway up            # deploys the Docker container
```

### Step 3 — Set environment variables
```bash
railway variables set SECRET_KEY=$(openssl rand -hex 32)
railway variables set ENVIRONMENT=production
railway variables set ALLOWED_ORIGINS=https://frontend-black-psi-12.vercel.app
# Railway auto-sets DATABASE_URL from the PostgreSQL plugin
```

### Step 4 — Run migrations
```bash
railway run alembic upgrade head
```

### Step 5 — Connect frontend to backend
In `bandhan/frontend/.env.production`:
```
NEXT_PUBLIC_API_URL=https://<your-railway-domain>.railway.app
```
Then redeploy frontend: `vercel deploy --prod`

---

## Alternative Backend — Render (also free)

1. Go to render.com → New → Blueprint
2. Connect your GitHub repo
3. Render will read `render.yaml` and create API + PostgreSQL automatically

---

## Architecture Summary

```
Client Browser
     │
     ▼
Vercel (Next.js frontend)          ← already deployed
     │
     ▼ HTTPS API calls
Railway / Render (FastAPI backend) ← deploy with steps above
     │
     ▼
PostgreSQL (Railway plugin / Render DB)
```

## Multi-tenant (white-label)
Each client gets their own subdomain:
- `clientname.bandhan.in` → sets `X-Tenant-ID: clientname` header
- All data is isolated by `tenant_id` in every DB table
