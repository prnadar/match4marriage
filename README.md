# Match4Marriage

An advisor-led matrimony platform for the British Indian community and the
global diaspora. Curated introductions, verified profiles, and a family-first
workflow — built as a monorepo with a Next.js web app, a FastAPI backend, and
an Expo React Native mobile app.

> Codename in earlier docs and a handful of database fields: **Bandhan**.
> Public product name is **Match4Marriage**.

---

## Repository layout

```text
match4marriage/
├── frontend/        Next.js 15 web app (App Router, TypeScript, Tailwind)
├── backend/         FastAPI service (Python 3.12, SQLAlchemy async, Alembic)
├── mobile/          Expo / React Native app (EAS build)
├── infra/           One-shot DB bootstrap SQL (extensions, etc.)
└── docker-compose.yml
```

| Layer    | Stack                                                          |
|----------|----------------------------------------------------------------|
| Web      | Next.js 15 · React 18 · TypeScript · Tailwind · Framer Motion  |
| Mobile   | Expo · React Native · Expo Router · Zustand                    |
| API      | FastAPI · SQLAlchemy 2 (async) · Pydantic v2 · Alembic         |
| Auth     | Firebase Auth (email + phone) — verified by the backend        |
| Database | PostgreSQL (Neon in production)                                |
| Cache    | Redis (OTP, rate limits) with a `fakeredis` fallback for dev   |
| Storage  | S3 / Cloudflare R2 (profile photos, ID documents)              |
| Realtime | WebSocket chat (`/api/v1/ws/chat/{thread_id}`)                 |
| Email    | Resend                                                         |
| Payments | Razorpay (primary) + Stripe (international)                    |

---

## Quick start

Prerequisites: Node 20+, Python 3.12+, Docker (optional, for Postgres/Redis).

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                # fill in DATABASE_URL, FIREBASE_*, etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local          # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                         # http://localhost:3000

# 3. Mobile (optional, new terminal)
cd mobile
npm install
npx expo start
```

Local infra via Docker:

```bash
docker compose up -d postgres redis
```

---

## Configuration

All configuration is through environment variables. Three template files are
checked in: `.env.example` (root, shared defaults), `backend/.env.example`,
`mobile/.env.example`. **Real `.env*` files must never be committed** — see
the secrets section below.

### Backend (`backend/.env`)

| Variable                | Purpose                                              |
|-------------------------|------------------------------------------------------|
| `ENVIRONMENT`           | `development` / `production`                         |
| `DATABASE_URL`          | `postgresql+asyncpg://…` (Neon connection string)    |
| `REDIS_URL`             | `redis://…` (falls back to `fakeredis` in dev)       |
| `SECRET_KEY`            | 64+ char random string for JWT signing               |
| `ALLOWED_ORIGINS`       | Comma-separated CORS allow-list                      |
| `FIREBASE_PROJECT_ID`   | Project ID from the Firebase Console                 |
| `FIREBASE_CLIENT_EMAIL` | Service account email                                |
| `FIREBASE_PRIVATE_KEY`  | Service account PEM (preserve `\n` line breaks)      |
| `RESEND_API_KEY`        | Transactional email                                  |
| `TWILIO_*`              | SMS OTP (optional — Firebase handles phone auth)     |
| `AWS_S3_BUCKET`, `AWS_*`| Profile photo + ID upload storage                    |
| `RAZORPAY_*`, `STRIPE_*`| Payment gateways                                     |

### Frontend (`frontend/.env.local`)

| Variable                                  | Purpose                            |
|-------------------------------------------|------------------------------------|
| `NEXT_PUBLIC_API_URL`                     | Backend base URL                   |
| `NEXT_PUBLIC_TENANT_ID`                   | `match4marriage` (or `bandhan`)    |
| `NEXT_PUBLIC_FIREBASE_API_KEY`            | Firebase web SDK                   |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`        | …                                  |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`         | …                                  |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`     | …                                  |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| …                                  |
| `NEXT_PUBLIC_FIREBASE_APP_ID`             | …                                  |

`NEXT_PUBLIC_*` values are bundled into the client at build time, so they are
not secret — but the file itself is still environment-specific and should not
be committed.

---

## Architecture

```text
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Web (Vercel)        │    │  Mobile (Expo)       │    │  Admin (web /admin)  │
│  Next.js 15          │    │  Expo Router         │    │  Same web bundle     │
└──────────┬───────────┘    └──────────┬───────────┘    └──────────┬───────────┘
           │                           │                           │
           │  HTTPS / JSON · Bearer JWT (Firebase ID token)        │
           └───────────────┬───────────┴───────────────────────────┘
                           ▼
                ┌─────────────────────────┐
                │  FastAPI (Railway)      │
                │  /api/v1/*              │
                │  /api/v1/ws/chat/{id}   │
                └────────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         PostgreSQL       Redis        S3 / R2
         (Neon)        (rate limits,   (photos,
                       OTP store)       ID docs)
```

### Multi-tenant design

Every database table carries a `tenant_id`. The frontend sends
`X-Tenant-ID: <slug>` on every request; the backend resolves the slug to a
UUID and scopes all queries by it. The slug is normalised in
[`frontend/lib/api.ts`](frontend/lib/api.ts) — only known-good values are
forwarded so a misconfigured env var cannot break the backend.

### Response envelope

Every API response uses one of two envelopes from `app/schemas/common.py`:

```jsonc
// Singular
{ "success": true, "data": { … }, "error": null, "message": null }

// Paginated
{ "success": true, "data": [ … ], "total": 42, "page": 1, "limit": 20, "has_next": true }
```

The frontend always reads payload at `response.data.data` — there is no
speculative decoding of multiple candidate keys.

### Auth flow

1. Client authenticates with Firebase (email + password or phone OTP).
2. Client sends the Firebase ID token as `Authorization: Bearer …`.
3. Backend verifies the token with the Firebase Admin SDK, extracts
   `uid` / `phone_number` / `email`, and matches it against the local
   `users` table — creating a row on first sign-in.
4. Profile completeness (`first_name`, phone, ID upload) gates which
   sections of the dashboard are unlocked. The dashboard layout shows
   a `VerificationBanner` for incomplete profiles instead of hard-redirecting
   to onboarding on every visit.

### Onboarding (three steps)

1. **Create account** — email + password via Firebase, save name to backend.
2. **About you** — DOB, gender, religion, mother tongue, education,
   profession, then link a phone credential to the same Firebase user via
   `linkWithCredential` so the user can sign in with either method.
3. **Verify identity** — government ID upload, stored in S3 / R2, reviewed by
   admins.

---

## Deployment

| Service  | Host                | Trigger              |
|----------|---------------------|----------------------|
| Frontend | Vercel              | Push to `main`       |
| Backend  | Railway (or Render) | Push to `main`       |
| Mobile   | EAS Build           | `eas build` manually |
| DB       | Neon                | Managed              |

### Deploy backend (Railway)

```bash
cd backend
railway login
railway init                              # create project: match4marriage-api
railway add --plugin postgresql           # adds Postgres, sets DATABASE_URL
railway variables set SECRET_KEY=$(openssl rand -hex 32)
railway variables set ENVIRONMENT=production
railway variables set ALLOWED_ORIGINS=https://match4marriage.com,https://<vercel-url>
railway variables set FIREBASE_PROJECT_ID=…
railway variables set FIREBASE_CLIENT_EMAIL=…
railway variables set FIREBASE_PRIVATE_KEY=…     # preserve \n in the PEM
railway up
railway run alembic upgrade head
```

Smoke test: `curl https://<api-url>/health` → `{ "status": "ok" }`.

### Deploy frontend (Vercel)

```bash
cd frontend
npx vercel link
npx vercel env add NEXT_PUBLIC_API_URL production
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
# …repeat for every NEXT_PUBLIC_FIREBASE_* var…
npx vercel --prod
```

### Firebase console

- Authentication → Sign-in method: enable **Email/Password** and **Phone**.
- Authentication → Settings → Authorized domains: add the Vercel preview
  domain and the production custom domain.
- (If using reCAPTCHA Enterprise for phone auth) Google Cloud → reCAPTCHA
  Enterprise → key → Allowed domains: add the same hostnames.

---

## Development workflow

```bash
# Backend
pytest -q                       # unit + integration
ruff check .                    # lint
mypy app                        # types

# Frontend
npm run dev                     # local server
npx tsc --noEmit                # type-check
npm run build                   # production build
```

ESLint is not yet wired up on the frontend — `npx next lint` falls back to
interactive setup. Configure once and add to CI before adding new rules.

---

## Security

### Never commit

- `*.env`, `.env.local`, `.env.production`, `.env.vercel`, `.env.development`
- Firebase service-account JSON
- Anything in `infra/secrets/`

The repo's `.gitignore` covers these patterns. If you accidentally commit a
real secret, **rotate it immediately** — git history is permanent.

### Currently known-public values

These are baked into the client bundle by design and are not sensitive on
their own (Firebase relies on auth state + security rules, not on hiding the
API key):

- `NEXT_PUBLIC_FIREBASE_*` for the web app
- `EXPO_PUBLIC_FIREBASE_*` for the mobile app

What **is** sensitive and must never leak:

- `FIREBASE_PRIVATE_KEY` (backend service account)
- `SECRET_KEY`, `DATABASE_URL`, `RESEND_API_KEY`, all payment gateway keys

---

## Roadmap

### Shipped

- ✅ Web frontend (40+ routes, App Router)
- ✅ Mobile app (Expo, all major screens)
- ✅ Full FastAPI backend: auth, profile, matches, interests, chat,
     notifications, subscriptions, kundali
- ✅ WebSocket chat with broadcast manager
- ✅ Multi-tenant architecture with row-level `tenant_id` scoping
- ✅ Trust-score system, ID verification flow
- ✅ Admin console: users, reports, payments, subscriptions, pricing
- ✅ Cinematic landing page with editorial video hero

### In progress / honest stubs

| Page               | State     | What's missing                                |
|--------------------|-----------|-----------------------------------------------|
| `/subscription`    | Read-only | Razorpay + Stripe hosted-checkout flow        |
| `/family`          | Stub      | Invitations, shared shortlists, private notes |
| `/nri-hub`         | Stub      | NRI filter + public stats endpoint            |
| `/success-stories` | Stub      | Admin CMS for stories + public list endpoint  |

### Near-term priorities

1. Live billing (Razorpay India + Stripe international).
2. Photo-level privacy controls (per-photo `is_private`, "request to see"
   flow).
3. Family mode (8 endpoints + 4 tables; see prior design notes).
4. Real-time chat polish: typing indicators, read receipts, voice notes.
5. Enable ESLint on the frontend and add it to CI.

---

## Conventions

- **TypeScript everywhere on the frontend.** No `any` in shipped code without
  a comment justifying it.
- **Sentence / Title case for headings.** No ALL CAPS rendering — the display
  font (Playfair Display) supports proper mixed case; we don't use
  `text-transform: uppercase` on user-visible copy.
- **Backend responses use the standard envelope** (`APIResponse`,
  `PaginatedResponse`). No ad-hoc shapes.
- **Migrations via Alembic.** Never alter the schema by hand against a real
  database.
- **One thing per PR.** Keep diffs focused so reviews stay tractable.

---

## License

Proprietary. © Match4Marriage. All rights reserved.
