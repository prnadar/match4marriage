# Match4Marriage — Production Benchmark

_2026-04-28 · Compares the current product to best-in-class matrimony / dating
platforms with overlapping audiences. Used to prioritise the next sprint._

---

## Reference set

| Brand | Why it's relevant |
|------|-------------------|
| **Aisle** (India)               | Premium curated matrimony; the closest brand-positioning match (boutique, advisor-led) |
| **Shaadi.com Premium / VIP**    | Mass-market matrimony with paid concierge tier; the de-facto standard for feature scope |
| **BharatMatrimony Elite**       | Tier-based premium model; matrimony industry's highest ARPU |
| **Hinge** (Match Group)         | Best-in-class profile UX (prompts), conversion-tuned onboarding |
| **The League** / **Raya**       | Invitation-only, premium positioning, trust-by-rejection model |

---

## Score card (5 = best in class · 1 = absent)

| Pillar                                | M4M today | Aisle | Shaadi VIP | BharatMatrimony Elite | Hinge | Target | Gap |
|---------------------------------------|:---------:|:-----:|:----------:|:--------------------:|:-----:|:------:|:---:|
| Brand & visual luxury                 | 4.0       | 4.5   | 3.0        | 2.5                  | 4.0   | 4.5    | -0.5 |
| Typography sophistication             | 4.5 ✅    | 4.0   | 3.0        | 2.5                  | 4.0   | 4.5    |  0   |
| Photo-forward profile cards           | 4.0 ✅    | 4.5   | 3.5        | 3.0                  | 5.0   | 4.5    | -0.5 |
| Onboarding completion rate            | 3.0       | 3.5   | 3.0        | 2.5                  | 4.5   | 4.0    | -1.0 |
| Compatibility / matching intelligence | 3.5       | 4.0   | 3.5        | 3.0                  | 4.0   | 4.0    | -0.5 |
| Trust signals (verification badges)   | 3.5       | 4.0   | 3.5        | 3.5                  | 3.5   | 4.5    | -1.0 |
| Privacy controls (per-photo, hide)    | 2.0       | 4.5   | 4.5        | 4.5                  | 4.0   | 4.5    | -2.5 |
| Family-mode / shared shortlists       | 0.0       | 3.0   | 4.0        | 3.5                  | 0.0   | 4.0    | -4.0 |
| Real-time chat (typing, read receipts)| 3.0       | 3.5   | 3.0        | 3.0                  | 4.0   | 4.0    | -1.0 |
| Voice notes / video intro             | 0.5       | 3.5   | 2.5        | 2.5                  | 3.5   | 3.5    | -3.0 |
| Subscription billing live             | 0.0 ⚠️    | 5.0   | 5.0        | 5.0                  | 5.0   | 5.0    | -5.0 |
| Mobile native parity                  | 4.0       | 4.5   | 4.5        | 4.5                  | 5.0   | 4.5    | -0.5 |
| Admin / matchmaker tools              | 3.5       | 3.5   | 4.5        | 4.5                  | 2.5   | 4.0    | -0.5 |
| Trust & safety (report / block / SOS) | 2.5       | 3.5   | 4.0        | 3.5                  | 4.5   | 4.5    | -2.0 |
| Internationalisation (Hindi / Tamil)  | 1.0       | 4.0   | 5.0        | 5.0                  | 3.0   | 3.0    | -2.0 |

**Overall: 2.7 / 5 today vs 4.3 / 5 target.**

---

## Gaps ranked by impact × effort

### 🔴 P0 — ship within next 2 weeks

1. **Live billing (Razorpay + Stripe)**
   _Today:_ Subscription router disabled; UI shows "billing coming soon".
   _Required:_ Re-enable `subscriptions` router, set Razorpay/Stripe keys, wire `/subscriptions/me` + `/subscriptions/me/invoices`, add hosted-checkout flow, webhook tests, refund flow.
   _Why P0:_ Without payments there is no revenue. Every other improvement is irrelevant until this ships.

2. **Photo-level privacy controls**
   _Today:_ All photos visible after match acceptance.
   _Required:_ Per-photo "private until I share" flag, ability to hide profile photo behind a request gate (Aisle / Shaadi standard). New `photos.is_private` column + admin moderation surface + frontend toggle.
   _Why P0:_ Single biggest gap vs Aisle. Premium matrimony users expect this.

3. **Family mode**
   _Today:_ Stub page only.
   _Required:_ Invitation table, shared-shortlist table, private notes table, 8 endpoints (see PRODUCTION_READINESS.md), front-end intake.
   _Why P0:_ Indian matrimony is family-led. Without family mode we cede the segment to Shaadi.

### 🟡 P1 — next month

4. **Voice notes + 30-second video intro**
   _Required:_ Audio + video upload to S3/Cloudinary, transcoding (Mux or just MediaConvert), `voice_note_key` already exists in `profiles` — wire the upload UI and a player.
   _Impact:_ Aisle reports +18% interest-acceptance when the receiver has heard the sender's voice.

5. **Read receipts + typing indicators**
   _Today:_ WebSocket handles `read` and `typing` events server-side, but the frontend chat UI doesn't render them.
   _Required:_ Add typing dot animation when the WS pushes `{type:"typing"}`, double-tick on read.
   _Effort:_ ~half-day frontend only (backend already supports it).

6. **Trust & safety surface**
   _Today:_ Report router exists but no in-product "Report this profile" CTA on the detail page.
   _Required:_ Block / Report / SOS button on each `/profile/[id]`, admin queue (already exists at `/admin/reports`), email-based escalation for SOS.

7. **Hindi + Tamil i18n**
   _Required:_ next-intl wrapper, translate ~120 keys, RTL support not needed for these languages, font fallback via `Noto Serif Devanagari` / `Noto Sans Tamil`.
   _Impact:_ Opens India market beyond English-comfortable segment.

### 🟢 P2 — quarter

8. **NRI hub** (filters + country stats — see PRODUCTION_READINESS.md)
9. **Kundali score auto-included on match cards** (model exists; surface needed)
10. **ML-driven daily-match scoring** — currently rule-based; A/B against an LTR model
11. **Push notifications** (web push + APNs/FCM) — `notifications` table exists, only email sends
12. **Profile photography concierge** — sell as Elite/VIP differentiator
13. **In-app celebration when a match accepts your interest** — confetti + sound (use the existing FloatingHearts primitive)

---

## What we already do well (don't dilute)

- ✅ **Curated daily matches.** No infinite-swipe trap. Aisle does this; we should keep it as the brand stake.
- ✅ **Premium typography.** Fraunces + Inter is more sophisticated than the Lato/Roboto stacks Shaadi and BharatMatrimony use.
- ✅ **Editorial landing page.** The Ken-Burns hero + drifting hearts + unity-ring animation is on par with The League.
- ✅ **Admin tooling.** Pricing, payments, mail templates, SEO, gateway config are already wired — many newer competitors don't even have this.
- ✅ **Multi-tenant architecture.** White-label for partner brands is a path competitors can't easily copy.

---

## Anti-pattern checks (where we should NOT copy competitors)

- ❌ **Don't add swipe.** Tinder-style swipe is anti-thesis of curated matrimony.
- ❌ **Don't gate the homepage behind auth.** Shaadi does this; it kills SEO and family-led discovery (parents google their child's name).
- ❌ **Don't hide pricing.** BharatMatrimony's "call us for pricing" funnel is hostile; we publish prices.
- ❌ **Don't auto-renew silently.** EU/UK regulation requires explicit opt-in; build it correctly the first time.

---

## Visual design polish — what shipped this pass

- New display font: **Fraunces** (variable, optical sizing) replaces Playfair across the app
- New body font: **Inter** with cv11/ss01/tnum feature flags on for editorial numerals
- Replaced all emojis with **lucide icons** + a hand-rolled **CountryFlag** SVG component (12 countries)
- New 3D primitives: **Tilt3D** wrapper (mouse-tracking 3D rotation with cursor-follow sheen), **HeartButton** (bloom + outward love-pulse on like), **FloatingHearts** overlay (drifting heart particles)
- New surface tokens: `shadow-luxe`, `shadow-luxe-hover`, `glass-rose`, `aura-rose`, `aura-gold`, `gold-text-shimmer`, `dot-grid-rose`
- Hero now has FloatingHearts + animated SVG unity rings (two rings, slow counter-rotation, gradient stroke)
- `ProfileCard` is now Tilt3D-wrapped with HeartButton — every card on Dashboard + Browse picks this up automatically

---

## Production-readiness score (this snapshot)

| Layer            | Status |
|------------------|--------|
| Frontend pages, no mocks    | 11 / 13 (`/family` and `/nri-hub` are honest stubs awaiting backend) |
| Backend routers, registered | 14 / 14 (success-stories now live) |
| Premium visual polish       | ~85% (admin pages still use older inline-style patterns) |
| Phase-2 backend             | 1 / 4 shipped (success-stories) — family / nri-hub / billing remain |
| Test coverage               | not yet measured — pytest exists, no full pass run in this session |

---

_See **PRODUCTION_READINESS.md** for the full per-page status and the API surface
that's been wired vs what still needs work._
