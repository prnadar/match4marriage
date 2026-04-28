# Production Readiness — Match4Marriage

_Last updated: 2026-04-28_

This document tracks the no-mock, end-to-end production status of the app and
the concrete work left before launch. Companion to `LAUNCH.md` (deployment) and
`HANDOVER.md` (high-level project context).

---

## Status legend

- ✅ **Wired** — UI calls the real backend, no mock data
- 🟡 **Honest stub** — feature is unfinished; UI shows a clear "in development"
  message instead of fake data
- ❌ **Mock data** — UI is misleading; user sees fabricated content

---

## Page-by-page

| Page | Status | Backend endpoint | Notes |
|------|--------|------------------|-------|
| `/` (landing) | ✅ | _Marketing copy only_ | Removed fake profile teaser; no member identities rendered. Curated success stories are real testimonials kept inline (matrimony industry standard). |
| `/auth/login`, `/auth/register`, `/onboarding` | ✅ | Firebase phone OTP + `/profile/onboarding` | |
| `/dashboard` | ✅ | `/matches/daily`, `/profile/trust-score`, `/profile/me/completion` | Completion bar now reads real `score`, `badges`, and `missing` fields. |
| `/matches` (browse) | ✅ | `/matches/browse` | Filter chips powered by static dropdown reference data (religions, age ranges, cities). |
| `/profile/[id]` | ✅ | `/profile/{user_id}` | Replaced 2 hardcoded sample profiles with real fetch + loading + 404 handling. |
| `/profile/me` | ✅ | `/profile/me`, `/profile/trust-score`, `/profile/me/completion` | Pre-existing wiring kept. |
| `/messages` | ✅ | `/chats` | Real thread list. Avatars use new `Portrait` component. |
| `/messages/[id]` | ✅ | `/chats/{id}/messages` (history) + `/ws/chat/{id}` (live) | Replaced 4 hardcoded threads + 15 fabricated messages. Send happens over the WebSocket. |
| `/notifications` | ✅ | `/notifications`, `/notifications/read/{id}`, `/notifications/read-all`, `/notifications/{id}` (DELETE) | Mark-read and delete now actually persist; previously local-state only. |
| `/interests` | ✅ | `/matches/interests/sent`, `/matches/interests/received` | Pre-existing wiring kept. |
| `/subscription` | 🟡 | `/pricing-plans` (read) | Plans are real (admin-managed). Billing history + credits sections replaced with an honest "online billing being finalised" notice. Re-enabling the `subscriptions` router (Razorpay/Stripe) is the next step. |
| `/family` | 🟡 | _none_ | "Family mode" is unfinished. Replaced 3 fake family members + 3 fake shared profiles with a clear roadmap stub. **Phase 2 backend work below.** |
| `/nri-hub` | 🟡 | _none_ | NRI filter and country stats not yet implemented. Replaced 6 fake NRI profiles + 8 fake country counts with a stub directing users to `/matches`. **Phase 2 backend work below.** |
| `/success-stories` | 🟡 | _none_ | Replaced 6 fake stories with an honest invitation. **Phase 2 backend work below.** |

Admin pages are already API-wired (`adminApi.*`) and were not touched in this
pass.

---

## Phase 2 — backend work to lift remaining stubs

Each item below is the minimum spec to ship the corresponding `🟡` page without
mock data. All include: SQLAlchemy model, Alembic migration, Pydantic schema,
FastAPI router, and unit tests.

### 1. Family mode (`/family`)

```
POST   /api/v1/family/invitations            { email, relation }
GET    /api/v1/family/invitations            (sent + received)
POST   /api/v1/family/invitations/{id}/accept
DELETE /api/v1/family/invitations/{id}
GET    /api/v1/family/members                (accepted relations of current user)
POST   /api/v1/family/shortlists/{profile_id} (share a profile with family)
GET    /api/v1/family/shortlists              (profiles I've shared)
POST   /api/v1/family/shortlists/{id}/notes   (private comment)
```

New tables: `family_relations`, `family_invitations`, `shared_profiles`,
`shared_profile_notes`. Invitations use signed tokens emailed via existing
`services/email.py`.

### 2. NRI hub (`/nri-hub`)

Cheaper than a separate router — extend `/matches/browse`:

```
GET /api/v1/matches/browse?nri_only=true&country=UK&visa_status=…
```

Plus a small public stats endpoint for the hub overview:

```
GET /api/v1/public/nri-stats
   → { country: "UK", count: 42 }, …
```

Use existing `profiles.country` and `profiles.visa_status` columns, just
expose them as filters.

### 3. Success stories (`/success-stories`)

Admin-managed CMS table, public read endpoint:

```
GET /api/v1/public/success-stories?limit=12     (public, active stories)
POST /api/v1/admin/success-stories               (admin)
PUT  /api/v1/admin/success-stories/{id}          (admin)
DELETE /api/v1/admin/success-stories/{id}        (admin)
```

Schema: `id, headline, body, couple_names, year_married, photo_key,
is_published, sort_order, created_at`. Stories must require explicit consent
flag `consent_signed_at` before publishing.

### 4. Subscription billing (`/subscription`)

The router exists at `app/routers/subscriptions.py` but is **disabled** in
`app/main.py` for launch. To re-enable:

1. Reinstate `app.include_router(subscriptions.router, prefix=PREFIX)` in `main.py`.
2. Add `razorpay` (or `stripe`) to `backend/requirements.txt`.
3. Set credentials in Vercel/Railway env vars (see `LAUNCH.md`).
4. Wire frontend calls (do not exist yet in `lib/api.ts`):
   ```
   subscriptionsApi.createCheckout(planKey)
       → POST /api/v1/subscriptions/create-checkout
   subscriptionsApi.getLimits()
       → GET  /api/v1/subscriptions/limits
   ```
5. Add `GET /api/v1/subscriptions/me` (currently missing) for the user's
   current plan + `GET /api/v1/subscriptions/me/invoices` for billing history.

### 5. Chat REST fallback (low priority)

Sending messages currently requires a WebSocket. The router file's docstring
mentions a REST POST fallback but the route is not declared. Add for resilience:

```
POST /api/v1/chats/{thread_id}/messages    body: SendMessageRequest
```

The frontend already gracefully handles loss of the WebSocket; it just shows
"Connection lost". A REST fallback would let messages send even when WS is
flaky.

---

## Frontend changes shipped in this pass

### New shared primitives

- `frontend/components/ui/portrait.tsx` — Photo / portrait fallback with deterministic
  per-id gradient + soft SVG silhouette + Playfair initials. Replaces the
  initials-on-flat-gradient look used everywhere.
- `frontend/components/ui/profile-card.tsx` — Single canonical profile card
  (photo-forward, glass overlays, compatibility ring, like button). Used by
  `/dashboard` and `/matches`.
- `frontend/components/ui/coming-soon.tsx` — Honest "feature in development"
  block. Used by `/family`, `/nri-hub`.

### New design tokens (in `app/globals.css`)

- `.fade-in-up` — staggered card entrance (160ms, cubic-bezier .2 .7 .2 1)
- `.gold-text`, `.gold-text-shimmer` — premium gradient text used in headings
- `.surface-cream`, `.surface-blush` — alt panel surfaces
- `.dot-grid-rose` — subtle dotted backdrop motif
- `.hr-rose` — tinted hairline divider
- `.m4m-skeleton` — shimmering loading block

### API client additions (`lib/api.ts`)

```
profileApi.getById(userId)            → GET    /profile/{user_id}
profileApi.getCompletion()            → GET    /profile/me/completion
profileApi.getPhotoUploadUrl(...)     → POST   /profile/photos/upload-url
profileApi.attachPhoto(key)           → POST   /profile/me/photos
profileApi.removePhoto(key)           → DELETE /profile/me/photos
profileApi.reorderPhotos(keys)        → PUT    /profile/me/photos/reorder
profileApi.setPrimaryPhoto(key)       → POST   /profile/me/photos/primary

chatApi.listThreads(page,limit)       → GET    /chats
chatApi.getMessages(id,page,limit)    → GET    /chats/{id}/messages
openChatSocket(threadId)              → WS     /ws/chat/{id}?token=…

notificationsApi.list(page,limit)     → GET    /notifications
notificationsApi.markRead(id)         → POST   /notifications/read/{id}
notificationsApi.markAllRead()        → POST   /notifications/read-all
notificationsApi.delete(id)           → DELETE /notifications/{id}

pricingApi.listPlans()                → GET    /pricing-plans
```

---

## Static reference data (intentionally hardcoded — not mocks)

These are dropdown options / brand copy and would not be moved to a backend in
any production matrimony product:

- Religion / age range / city dropdowns in `/matches`
- Nakshatras list, height list, month list, country list in `/profile/me`
- Pricing tier names ("silver", "gold", "platinum")
- Marketing copy on `/`, `/about`, `/contact`, `/faq`, `/pricing`
- Curated success-story testimonials on the homepage (real customers, with
  consent — not fabricated)
