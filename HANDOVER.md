# Match4Marriage — Developer Handover Document
_Prepared by Jarwis | April 2, 2026_

---

## 🎯 Project Overview

**Match4Marriage** (codename: Bandhan) is a matrimony app with:
- **React Native (Expo)** mobile app — APK built and delivered ✅
- **Next.js 15** web frontend — live on Vercel ✅
- **Python FastAPI** backend — live on Railway ✅
- **Multi-tenant / white-label** architecture (subdomain-based)

**Your job:** Complete the remaining blockers and get this to production-ready state.

---

## 🌐 Live URLs

| Service | URL | Status |
|---------|-----|--------|
| Web Frontend | https://frontend-black-psi-12.vercel.app | ✅ Live |
| Backend API | https://match4marriage-api-production-54ea.up.railway.app | ✅ Live |
| Mobile APK | https://expo.dev/artifacts/eas/dKckRN7ouc9HaB2R4EoAFq.apk | ✅ Built |

---

## 📁 Project Structure

```
match4marriage/
├── backend/                    # FastAPI backend (Python)
│   ├── app/
│   │   ├── core/               # Config, DB, Redis, Security, Tenancy
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── routers/            # API endpoints (auth, chat, matches, profile, etc.)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (OTP, email, matching, storage)
│   │   └── migrations/         # Alembic DB migrations
│   ├── Dockerfile
│   └── backend/.env.example    # Copy to .env and fill in
├── mobile/                     # Expo React Native app
│   ├── app/                    # File-based routing (Expo Router)
│   │   ├── (auth)/             # Login, Onboarding screens
│   │   ├── (tabs)/             # Home, Matches, Interests, Messages, Profile
│   │   └── ...                 # Settings, Subscription, Kundali, NRI Hub
│   ├── components/             # Reusable UI components
│   ├── lib/                    # API client, theme, storage
│   ├── store/                  # Auth state (Zustand)
│   └── eas.json                # EAS build config
└── DEPLOY.md                   # Deployment guide
```

---

## 🔴 CRITICAL BLOCKERS — What You Need to Complete

### 1. OTP / SMS via Twilio ⚠️ HIGH PRIORITY

**Problem:** Twilio is not configured. In production, OTPs are not being delivered via SMS. The app has a fallback (`000000`) but this is NOT production-ready.

**Fix required:**
1. Create a Twilio account at twilio.com
2. Get a verified phone number (or use Messaging Service SID)
3. Set these env vars on Railway:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Code location:** `backend/app/services/otp.py`

The code is already written — just needs credentials. In production, also set:
```
DEMO_MODE=false
```

---

### 2. Photo Upload — S3/Cloudflare R2 ⚠️ HIGH PRIORITY

**Problem:** Profile photo upload is not working. The S3 bucket is configured but credentials are empty.

**Fix required:**
1. Create an AWS S3 bucket OR Cloudflare R2 bucket (R2 is cheaper — recommended)
2. Set these env vars on Railway:
```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=match4marriage-media
AWS_REGION=ap-south-1
AWS_CLOUDFRONT_DOMAIN=your_cdn_domain (optional)
```

**Code location:** `backend/app/services/storage.py`

The upload logic is already written — just needs credentials.

---

### 3. `/interests/sent` API Endpoint Missing ⚠️ HIGH PRIORITY

**Problem:** The mobile app calls `/api/v1/interests/sent` to show interests the user has sent. This endpoint doesn't exist in the backend.

**Fix required:** Add to `backend/app/routers/matches.py`:

```python
@router.get("/interests/sent", response_model=APIResponse[list[dict]])
async def get_sent_interests(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Get interests sent by the current user."""
    import uuid
    user_uuid = uuid.UUID(current_user.get("sub", ""))
    
    result = await db.execute(
        select(Match).where(
            Match.sender_id == user_uuid,
            Match.deleted_at.is_(None),
        ).order_by(Match.created_at.desc())
    )
    interests = result.scalars().all()
    
    # Fetch receiver profiles
    data = []
    for interest in interests:
        receiver_result = await db.execute(
            select(User).where(User.id == interest.receiver_id)
        )
        receiver = receiver_result.scalar_one_or_none()
        if receiver:
            data.append({
                "id": str(interest.id),
                "status": interest.status,
                "created_at": interest.created_at.isoformat(),
                "receiver": {
                    "id": str(receiver.id),
                    "phone": receiver.phone,
                }
            })
    
    return APIResponse(success=True, data=data)
```

---

### 4. Registration API — Real User Creation ⚠️ HIGH PRIORITY

**Problem:** The `/auth/register` endpoint only sends OTP but doesn't create a proper user profile. After OTP verification, users land on onboarding but profile data (name, age, etc.) isn't being saved properly.

**What's needed:**
- After OTP verify → create `UserProfile` row with onboarding data
- The onboarding screen in the mobile app (`app/(auth)/onboarding.tsx`) needs to POST profile data to `/api/v1/profile/` after OTP success

**Code location:** 
- `backend/app/routers/auth.py` — `verify_otp_endpoint()`
- `backend/app/routers/profile.py` — profile creation endpoint
- `mobile/app/(auth)/onboarding.tsx` — mobile onboarding flow

---

### 5. Auth0 → Demo Token (Production Auth) ⚠️ MEDIUM PRIORITY

**Problem:** Auth0 is not configured. The system issues a `demo:user_id` token which works for dev but is NOT secure for production.

**Options:**
- **Option A (Quick):** Keep demo tokens but add JWT signing with a secret key so they can't be forged
- **Option B (Proper):** Integrate Auth0 or Supabase Auth

**Current token code in:** `backend/app/routers/auth.py` → `verify_otp_endpoint()`
**Token validation in:** `backend/app/core/security.py`

For Option A (quick fix), update `security.py` to sign/verify tokens with HMAC instead of just splitting on `:`.

---

### 6. Email Verification (SendGrid/Resend) ⚠️ MEDIUM PRIORITY

**Problem:** Email sending not working. The email service uses Resend API but no key is configured.

**Fix:**
1. Sign up at resend.com (free tier available)
2. Set env var: `RESEND_API_KEY=re_xxxxxxxx`
3. Verify sender domain or use their free sandbox

**Code location:** `backend/app/services/email.py`

---

### 7. Payment Gateway — Razorpay ⚠️ MEDIUM PRIORITY

**Problem:** Subscription payments not wired up. Razorpay keys are empty.

**Fix:**
1. Create Razorpay account at razorpay.com
2. Set:
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

**Code location:** `backend/app/routers/subscriptions.py`

---

### 8. CORS Configuration ⚠️ LOW PRIORITY

**Problem:** CORS is set to a hardcoded list of origins. When deploying to a custom domain, this needs updating.

**Fix:** Update `ALLOWED_ORIGINS` env var on Railway:
```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://frontend-black-psi-12.vercel.app
```

**Code location:** `backend/app/core/config.py` → `allowed_origins_list` property

---

## 🛠 Tech Stack

### Backend
| Tech | Version | Purpose |
|------|---------|---------|
| Python | 3.14 | Runtime |
| FastAPI | latest | API framework |
| SQLAlchemy | 2.x async | ORM |
| Alembic | latest | DB migrations |
| PostgreSQL | latest | Database (Railway) |
| Redis | latest | OTP store, rate limiting |
| fakeredis | fallback | Dev/when Redis unavailable |
| Pydantic v2 | latest | Validation |
| Twilio | latest | SMS OTP |
| Resend | latest | Transactional email |

### Mobile
| Tech | Version | Purpose |
|------|---------|---------|
| Expo | latest | React Native framework |
| Expo Router | latest | File-based navigation |
| React Native | latest | UI |
| Zustand | latest | Auth state |
| TanStack Query | latest | API data fetching |
| TypeScript | latest | Type safety |

### Frontend (Web)
| Tech | Version | Purpose |
|------|---------|---------|
| Next.js | 15 | Web framework |
| TypeScript | latest | Type safety |
| Tailwind CSS | latest | Styling |

---

## 🔑 Environment Variables

### Backend (.env or Railway vars)

```env
# App
APP_NAME=Match4Marriage API
ENVIRONMENT=production
DEBUG=false

# Database (Railway auto-sets this)
DATABASE_URL=postgresql+asyncpg://...

# Redis (Railway auto-sets this if you add Redis plugin)
REDIS_URL=redis://...

# OTP
TWILIO_ACCOUNT_SID=          # ← NEEDED
TWILIO_AUTH_TOKEN=            # ← NEEDED
TWILIO_PHONE_NUMBER=          # ← NEEDED
DEMO_MODE=false               # Set to false in production

# Storage
AWS_ACCESS_KEY_ID=            # ← NEEDED (or use Cloudflare R2)
AWS_SECRET_ACCESS_KEY=        # ← NEEDED
AWS_S3_BUCKET=match4marriage-media
AWS_REGION=ap-south-1

# Email
RESEND_API_KEY=               # ← NEEDED

# Payments
RAZORPAY_KEY_ID=              # ← NEEDED
RAZORPAY_KEY_SECRET=          # ← NEEDED
RAZORPAY_WEBHOOK_SECRET=      # ← NEEDED

# CORS
ALLOWED_ORIGINS=https://frontend-black-psi-12.vercel.app

# Tenancy
DEFAULT_TENANT_SLUG=match4marriage
TENANT_HEADER=X-Tenant-ID
```

### Mobile (eas.json / app.config.js)

The API URL is configured in `mobile/lib/api.ts`. Update the base URL if backend URL changes.

---

## 📱 Mobile App — Key Files

| File | Purpose |
|------|---------|
| `mobile/lib/api.ts` | API client — all backend calls go through here |
| `mobile/store/auth.ts` | Auth state (token storage, login/logout) |
| `mobile/app/(auth)/login.tsx` | Phone number entry + OTP screen |
| `mobile/app/(auth)/onboarding.tsx` | Profile setup after first login |
| `mobile/app/(tabs)/index.tsx` | Home / discover screen |
| `mobile/app/(tabs)/matches.tsx` | Matches list |
| `mobile/app/(tabs)/interests.tsx` | Interests sent/received |
| `mobile/app/(tabs)/messages/` | Chat screens |
| `mobile/app/(tabs)/profile.tsx` | My profile |

---

## 🔌 Backend API — Key Endpoints

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/api/v1/auth/register` | ✅ Works | Sends OTP |
| POST | `/api/v1/auth/verify-otp` | ✅ Works | Returns token |
| POST | `/api/v1/auth/resend-otp` | ✅ Works | |
| GET | `/api/v1/profile/me` | ✅ Works | Get own profile |
| PUT | `/api/v1/profile/me` | ✅ Works | Update profile |
| GET | `/api/v1/matches/` | ✅ Works | Get matches |
| POST | `/api/v1/matches/interest` | ✅ Works | Send interest |
| GET | `/api/v1/matches/interests/received` | ✅ Works | |
| GET | `/api/v1/matches/interests/sent` | ❌ MISSING | **Build this** |
| GET | `/api/v1/chat/{thread_id}` | ✅ Works | Chat messages |
| POST | `/api/v1/subscriptions/` | ⚠️ Partial | Needs Razorpay |
| POST | `/api/v1/auth/send-verification-email` | ⚠️ Needs creds | |

---

## 🚀 Local Dev Setup

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env values

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### Mobile
```bash
cd mobile
npm install
npx expo start
# Press 'a' for Android emulator or scan QR for Expo Go
```

### Build APK
```bash
cd mobile
eas build --platform android --profile production
```

---

## 🔗 Repositories & Accounts

| Resource | Details |
|----------|---------|
| Backend GitHub | https://github.com/prnadar/bandhan-backend |
| Expo Account | prabhakar.victory@googlemail.com / username: prnadar |
| Railway (backend) | https://railway.app — check with Prabhakar for login |
| Vercel (frontend) | https://vercel.com — check with Prabhakar for login |

---

## ✅ What's Already Done (Don't Redo)

- ✅ Full backend API (auth, profile, matches, interests, chat, notifications, subscriptions, kundali)
- ✅ Multi-tenant architecture
- ✅ OTP flow (code complete, just needs Twilio creds)
- ✅ Email verification flow (code complete, just needs Resend creds)
- ✅ Mobile app — all screens built (login, onboarding, home, matches, interests, messages, profile, settings, subscription, kundali, NRI hub)
- ✅ Web frontend — all pages live on Vercel
- ✅ APK built and delivered
- ✅ Database schema + migrations
- ✅ Rate limiting
- ✅ Redis OTP store with fakeredis fallback
- ✅ Kundali matching via VedAstro API
- ✅ Profile photo upload code (needs S3 creds)
- ✅ Cinematic dark mode UI theme

---

## 📋 Priority Order for New Developer

1. **Day 1:** Set up Twilio → test OTP end-to-end on real device
2. **Day 1:** Set up Resend → test email verification
3. **Day 2:** Set up S3/R2 → test photo upload
4. **Day 2:** Build `/interests/sent` endpoint
5. **Day 3:** Fix auth token security (sign with HMAC)
6. **Day 3:** Test full user journey: register → OTP → onboarding → browse matches → send interest → chat
7. **Day 4:** Set up Razorpay → test subscription flow
8. **Day 5:** Full QA pass + fix any bugs found

---

## ⚠️ Important Rules

1. **NEVER push to `main` branch without Prabhakar's explicit approval**
2. Build → test on dev branch → show Prabhakar → get "go ahead" → then push to production
3. Backend is deployed via Railway with auto-deploy from `main` branch of `prnadar/bandhan-backend`
4. Frontend is deployed via Vercel with auto-deploy from git push

---

## 📞 Contact

**Project Owner:** Prabhakar Nadar  
**For questions on architecture/decisions:** Ask Prabhakar

---

_This document covers everything needed to take Match4Marriage from current state to production-ready. All the hard architectural work is done — this is primarily credential setup, one missing endpoint, and QA._
