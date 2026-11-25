# Match4Marriage design system

Elite Indian matrimony, established in the UK. The product should feel like a
private members' club with an editorial eye, and never like a dating app.

This page is the whole system. Tokens live in the `MATCH4MARRIAGE DESIGN SYSTEM`
block at the end of `app/globals.css`, are exposed to Tailwind under the `m4m`
namespace in `tailwind.config.ts`, and are used by the primitives in
`components/m4m/`. The reference implementations are the member shell
(`app/(app)/layout.tsx`), the membership-journey screen
(`components/ApprovalGate.tsx`) and the consent card
(`components/ConsentPrompt.tsx`).

Status: the tokens and primitives exist; most pages have not adopted them yet.
The order of adoption is in [Roll-out](#roll-out). The legacy named colours
(`ruby`, `rose`, `gold`, `blush`…) and the shadcn tokens in `tailwind.config.ts`
still work and are still what un-migrated pages and the admin console use. Do
not add to them.

## 1. Principles

1. **Quiet.** One thing per view is allowed to ask for attention: the rose
   action. Everything else is ink, white at a chosen opacity, and a little gold.
2. **Lines, not light.** Structure comes from 1px hairlines and space. Nothing
   glows, nothing floats unless it really is on top of the page.
3. **Editorial.** A serif display face for what matters (a name, a welcome, a
   title), small gold capitals to label, generous leading, one column of text
   no wider than 60 characters.
4. **Trust before romance.** This is a serious, family decision. Verification,
   privacy and status are stated plainly in words. No hearts raining down the
   screen, no countdowns, no fake numbers.
5. **Calm motion.** Things arrive once, quickly, and then hold still.

### What premium does not look like here

| Anti-pattern | Where it is today | Do instead |
| --- | --- | --- |
| Glow blobs / aurora backdrops (`blur(120px)` radial gradients) | dashboard, matches, messages, subscription, settings | The flat aubergine ground, `bg-m4m-ground` |
| Glassmorphism (`backdrop-blur` on cards and chips) | dashboard, subscription, matches, profile badges | `Surface` (4% white wash + hairline). Blur is allowed only on the sticky app bar |
| Gradient text (`.gold-text`, `bg-clip-text`) | subscription hero, home | Solid `text-m4m-fg` or `text-m4m-gold-champagne` |
| Coloured glow shadows (`0 10px 28px rgba(220,30,60,.6)`) | every rose button outside the gate | `shadow-m4m-raised` (neutral black) on the primary button only |
| More than one rose action in a view | interests rows, matches, subscription tiers | One `PrimaryButton`; the rest are `QuietButton` |
| Rose as a tint, badge or decoration | notification dots, tab counters, chips | Rose is for the action and the active marker. Use `StatusWord` |
| Tinted pill badges with icons | profile, interests, dashboard alerts | `StatusWord`: small caps, no background |
| Cards inside cards; a card around everything | dashboard, settings | One `Surface` level; divide inside with `Hairline` |
| Hover lift, scale, sheen sweeps, infinite pulses | `.luxe-sheen`, `.warm-card:hover`, register heart | Colour-only hover; motion only on arrival |
| Emoji as icons | none in member/public UI today: keep it that way | lucide icons at 1.5 stroke |
| Weights of 700+, all-caps headings | 100+ uses of 700 | 600 is the heaviest weight; capitals only in the kicker and status word |
| A light page inside the dark shell | `profile/[id]` | Member pages sit on the aubergine ground |

## 2. Colour

No new colours: every token is a value that was already in the codebase,
chosen as the canonical member of its cluster. Each colour has one job.

### Roles

| Role | Tokens | Tailwind | Use | Never |
| --- | --- | --- | --- | --- |
| **Rose**: the single primary action, and the active state | `--m4m-rose` `#dc1e3c`, `--m4m-rose-deep` `#a0153c`, `--m4m-rose-fill` (135° gradient of the two) | `bg-m4m-rose`, `bg-m4m-rose-fill` | The one `PrimaryButton` in a view; the 2px active marker in navigation; checkbox/radio accent | Text on the dark ground (3.8:1, fails AA); badges; borders; shadows |
| Rose as text on dark | `--m4m-rose-soft` `#ff8aa3` | `text-m4m-rose-soft` | Active nav icon, "attention" status, inline errors | Body copy |
| Links and focus on dark | `--m4m-rose-blush` `#ffd4dc` | `text-m4m-rose-blush`, `outline-m4m-focus-dark` | Inline links in running text, the focus ring | Fills |
| **Gold**: hairlines, small-caps labels, status and membership | `--m4m-gold` `#c9954a`, `--m4m-gold-label` (95%), `--m4m-hairline-gold` (28%), `--m4m-hairline-gold-strong` (50%) | `text-m4m-gold-label`, `border-m4m-hairline-gold`, `bg-m4m-gold` | `Kicker`; rules above membership content; avatar ring; progress bar; completed step rail | Buttons; large fills; gradients; glow |
| Champagne | `--m4m-gold-champagne` `#f3c9a8` | `text-m4m-gold-champagne` | Status words, tier names, accent icons, the arrow in a quiet link | Paragraphs |
| Gold as text on light | `--m4m-gold-deep` `#8a5e20` | `text-m4m-gold-deep` | `Kicker` and status on ivory (`#c9954a` there is 2.6:1) | Dark ground |
| **Green**: verified / complete, nothing else | `--m4m-verified` `#86efac` (dark), `--m4m-verified-deep` `#3f5937` (light) | `text-m4m-verified` | The tick beside "Verified", a completed step | Success banners, buttons, "online" dots, prices |
| **Ink**: the aubergine ground | `--m4m-ink-950` `#0b0509`, `-900` `#170811`, `-850` `#1a0a14`, `-800` `#220c1a` | `bg-m4m-ink-900` … | Grounds, sheets, ink text on light | |

### Surfaces and hairlines

| Token | Value | Tailwind | Use |
| --- | --- | --- | --- |
| `--m4m-surface-ground` | `linear-gradient(165deg,#170811,#220c1a 45%,#0b0509)` | `bg-m4m-ground` | Every member page |
| `--m4m-surface-rail` | `linear-gradient(180deg,#170811,#1a0a14 55%,#0b0509)` | `bg-m4m-rail` | The sidebar |
| `--m4m-surface-bar` | `rgba(23,8,17,.97)` | `bg-m4m-surface-bar` | Sticky app bar |
| `--m4m-surface-card` | white 4% | `bg-m4m-surface-card` | `Surface` |
| `--m4m-surface-quiet` | white 2.5% | `bg-m4m-surface-quiet` | A module inside a rail |
| `--m4m-surface-hover` / `-active` | white 6% / 5.5% | `bg-m4m-surface-hover` | Row and icon-button hover; selected row |
| `--m4m-surface-sheet` | `#1a0a14` | `bg-m4m-surface-sheet` | Opaque overlays |
| `--m4m-surface-scrim` | black 60% | `bg-m4m-surface-scrim` | Behind drawers and dialogs |
| `--m4m-ivory`, `-deep`, `--m4m-paper` | `#fdf9f4`, `#faf3eb`, `#fff` | `bg-m4m-ivory` … | Public marketing pages |
| `--m4m-hairline` | white 8% | `border-m4m-hairline` | Default divider and card edge |
| `--m4m-hairline-strong` | white 12% | `border-m4m-hairline-strong` | Inputs, rails |
| `--m4m-hairline-control` | white 20% | `border-m4m-hairline-control` | `QuietButton` outline |
| `--m4m-hairline-light` | ink 10% | `border-m4m-hairline-light` | Dividers on ivory |

### Text

Contrast is measured against `#220c1a`, the lightest point of the ground.

| Token | Value | Ratio | Use |
| --- | --- | --- | --- |
| `--m4m-fg` | `#ffffff` | 17.6 | Headings, emphasis |
| `--m4m-fg-body` | `#e7dde0` | 13.9 | Running text |
| `--m4m-fg-soft` | white 78% | 11.4 | Secondary copy, quiet-button label |
| `--m4m-fg-muted` | white 65% | 8.1 | Notes, captions |
| `--m4m-fg-faint` | white 55% | 6.1 | Meta. **The floor for text** |
| `--m4m-ink-text` / `-soft` / `-muted` | `#1a0a14` / `#4a3a40` / `#6a5560` | 18.5 / 10.3 / 6.6 | On ivory and paper |

White below 50% fails AA on this ground (45% is 4.47:1). 30% is for decorative
chevrons only. On ivory, `#88787f` (4.0:1) and `#aaa`/`#bbb` fail: use
`--m4m-ink-text-muted`.

m4m colours carry their own alpha, so Tailwind opacity modifiers
(`text-m4m-fg/50`) are not supported on purpose: pick the role instead.

## 3. Typography

Two families, and only two.

| Role | Face | Token / class | Weights |
| --- | --- | --- | --- |
| Display | **Source Serif 4** (roman + italic, optical sizes) | `--font-display`, `font-display` | 600 for headings; 500 for names in dense UI; italic 500 for an accent phrase |
| Everything else | **Inter** | `--font-nav` / `--font-body`, `font-nav` / `font-body` | 400 text, 500 navigation and labels, 600 buttons, kickers, emphasis |

Why these two. Source Serif 4 is a transitional serif in the Fournier
tradition, the same engraved, bookish lineage as a formal invitation, without
the wedding clichés of a thin Garamond or a script. Its optical-size axis
thickens the hairlines at 17–20px (card titles, names in lists), where a
high-contrast display face breaks up on Windows, and sharpens them at 42–58px.
Inter is the plainest thing that does the hard jobs well: large x-height and
open shapes at 12–14px on both ClearType/DirectWrite and macOS, true tabular
numerals for prices, dates and membership numbers, and it stays out of the
serif's way. Both cover Latin Extended and Latin Extended Additional, so
transliterated names (Śrīnivāsan, Ṭhākur, Aṣṭha) are set in the brand faces
instead of falling back to a system font, which the previous Playfair Display
and Open Sans could not do.

Loading. Both are variable fonts self-hosted by `next/font/google` in
`app/layout.tsx` (`display: swap`, Latin preloaded, Latin Extended on demand,
metric-matched fallbacks). No request goes to Google Fonts at runtime. They are
exposed as `--m4m-face-serif` and `--m4m-face-sans`; never reference those
directly, use the tokens above.

Legacy names. `--font-playfair`, `--font-cinzel`, `--font-display-alt`,
`--font-poppins`, `--font-lato`, `--font-script`, `--font-great-vibes` and the
classes `.font-playfair`, `.font-poppins`, `font-editorial`, `font-script` are
aliases of the two faces. They exist so old pages keep working; do not use them
in new code. There is no script face and no second serif.

### Scale

| Step | Class | Size | Use |
| --- | --- | --- | --- |
| Hero | `text-m4m-hero` | 58px / 1.08 | One statement per page, desktop only (`DisplayHeading size="hero"` steps 32 → 42 → 58) |
| Page | `text-m4m-page`, `-lg` | 32px, 42px / 1.12 | The title of a page |
| Section | `text-m4m-section`, `-lg` | 20px, 24px / 1.25 | A section inside a page |
| Title | `text-m4m-title` | 18px / 1.25 | Card, row, dialog title; a member's name in a list |
| Lead | `text-m4m-lead` | 18px / 1.7 | One intro paragraph per page |
| Body | `text-m4m-body` | 16px / 1.7 | Running text |
| UI | `text-m4m-ui` | 14px / 1.4 | Buttons, navigation, form controls |
| Small | `text-m4m-small` | 13px / 1.55 | Meta, dense UI, small buttons |
| Caption | `text-m4m-caption` | 12px / 1.5 | The smallest running text |
| Kicker | `text-m4m-kicker`, `-sm` | 11.5px, 10px, caps, +0.2em, 600 | `Kicker` |
| Status | `text-m4m-status` | 10.5px, caps, +0.16em, 600 | `StatusWord` |

Rules:

- The four display steps use the serif; everything from Lead down uses the sans.
- Headings are mixed case, `text-wrap: balance`, never gradient, never above 600.
- Running text is capped at `max-w-m4m-measure` (60ch) and never below 12px.
- Capitals appear only in the kicker and the status word, always tracked.
- Numbers that line up in a column (prices, dates, counts, membership numbers)
  take `tabular-nums` on the numeric cell or value. It is not global: Inter's
  tabular feature also widens hyphens, commas and colons to figure width, so
  keep it off names and running text.
- An italic accent inside a heading is the serif's own italic, at the same
  size as the heading, in champagne on dark or rose on ivory. One per heading.
- Do not pass `text-m4m-*` size classes through `cn()` / tailwind-merge together
  with `text-m4m-*` colour classes: it will drop one. Use `cx` from
  `components/m4m`.

## 4. Shape, elevation, space

**Radius**, five steps: `rounded-m4m-xs` 4px (focus, marks), `-sm` 10px (rows,
icon buttons, inputs), `-md` 12px (cards), `-lg` 20px (sheets, dialogs),
`-pill` (buttons, avatars). Nothing else; not 16, 22, 24 or 26.

**Elevation** favours hairlines. A thing gets a shadow only if it sits on top
of other content, and the shadow is neutral black.

| Token | Class | Use |
| --- | --- | --- |
| hairline | `border border-m4m-hairline` | Default: cards, modules, dividers |
| `--m4m-elev-inset` | `shadow-m4m-inset` | Selected row |
| `--m4m-elev-ring-gold` | `shadow-m4m-ring-gold` | Avatar ring |
| `--m4m-elev-raised` | `shadow-m4m-raised` | The primary button, nothing else |
| `--m4m-elev-float` | `shadow-m4m-float` | Floating pill, popover, menu |
| `--m4m-elev-sheet` | `shadow-m4m-sheet` | Bottom sheet, dialog |

**Space.** Tailwind's 4px scale; prefer 1, 2, 3, 4, 6, 10, 16 (4–64px). Page
gutters are `px-m4m-gutter` (16) / `sm:px-m4m-gutter-md` (24) /
`lg:px-m4m-gutter-lg` (40). The app bar and the sidebar's top row are both
`h-m4m-bar` (64px) so their hairlines meet. Every interactive target is at
least `min-h-m4m-tap` (44px). The widest column is `max-w-m4m-content` (1180px).
Group tightly, separate generously, and leave more space above a heading than
below it.

## 5. Components (`components/m4m`)

```tsx
import {
  Kicker, DisplayHeading, Hairline, Surface, StatusWord,
  PrimaryButton, QuietButton, ButtonArrow, Entrance, EntranceItem,
} from "@/components/m4m";
```

Every primitive takes `ground="dark" | "light"` (default dark) and a
`className` for layout.

| Primitive | What it is | Rules |
| --- | --- | --- |
| `Kicker` | Gold small-caps label. `size="sm"` 10px, `"md"` 11.5px | Names a page or a group. One per page header, one per labelled group; not above every section. Never a sentence |
| `DisplayHeading` | Serif heading. `size` hero / page / section / title; `as` sets the semantic level separately | One `h1` per page. Pick the level from the outline, the size from the hierarchy |
| `Hairline` | 1px rule, horizontal or vertical. `tone` default / strong / gold | Gold only for editorial or membership rules. Never a coloured side-stripe wider than 1px |
| `Surface` | Hairline card. `tone` card / quiet / gold / sheet; `padding` none / sm / md / lg | No shadow, no blur. Never nested. `gold` is for membership content only. If the content reads without a container, leave it out |
| `PrimaryButton` | The rose pill. `size` sm / md / lg; `asChild` to style a `Link` | **One per view.** Label names the action ("Complete your profile", not "Continue") |
| `QuietButton` | Hairline pill that warms to gold on hover | Every other action, including "Cancel", "Not now" and destructive ones |
| `ButtonArrow` | Trailing arrow that nudges 2px on hover | Only on buttons that navigate |
| `StatusWord` | Small-caps status. `tone` progress / attention / verified / neutral; `dot` | Replaces tinted badges. The word carries the meaning; the green tick appears only for `verified` |
| `Entrance`, `EntranceItem`, `useM4MMotion` | Staggered arrival | See Motion |

Example, the header of a member page:

```tsx
<Entrance className="mx-auto max-w-m4m-content px-m4m-gutter lg:px-m4m-gutter-lg">
  <EntranceItem><Kicker>Introductions</Kicker></EntranceItem>
  <EntranceItem>
    <DisplayHeading as="h1" size="page" className="mt-5">Your matches this week</DisplayHeading>
  </EntranceItem>
  <EntranceItem>
    <p className="mt-5 max-w-m4m-measure text-m4m-body text-m4m-fg-muted">Seven profiles chosen for you.</p>
  </EntranceItem>
  <EntranceItem className="mt-8 flex gap-4">
    <PrimaryButton asChild><Link href="/matches">Browse all members<ButtonArrow /></Link></PrimaryButton>
    <QuietButton>Refine preferences</QuietButton>
  </EntranceItem>
</Entrance>
```

Not yet primitives (build them on the tokens when a page needs them, then move
them here): text input and select, toggle, tabs, dialog/sheet, avatar, empty
state, toast.

## 6. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--m4m-ease-out` / `ease-m4m-out` / `M4M_EASE_OUT` | `cubic-bezier(0.22, 1, 0.36, 1)` | The only curve |
| `duration-m4m-press` | 120ms | Tap feedback (2% scale) |
| `duration-m4m-fast` | 180ms | Hover colour and background |
| `duration-m4m-base` | 200ms | Fades, button states |
| `duration-m4m-slow` | 320ms | Drawer, panel, list group |
| `duration-m4m-entrance` | 500ms | A page item arriving (12px rise + fade) |
| `--m4m-stagger` / `M4M_STAGGER` | 80ms | Between entrance items |

- Animate `transform` and `opacity` only. No bounce, no spring overshoot.
- One entrance per page, on arrival, via `Entrance`. Content is never hidden
  waiting for a scroll trigger inside the app.
- Hover changes colour; it does not lift, scale, glow or sweep.
- Nothing loops, except a single slow pulse that says "we are waiting on
  something" (the in-review step). No drifting backdrops, floating hearts or
  shimmering text.
- Reduced motion: `globals.css` already zeroes CSS transitions and animations;
  Framer Motion must go through `Entrance` / `useM4MMotion()`, which render the
  final state immediately.

## 7. Accessibility

- **Contrast**: text at least 4.5:1, large display text and icons that carry
  meaning at least 3:1. Use the text tokens; do not invent an opacity.
- **Focus**: every interactive element shows the ring: 2px, 3px offset,
  `--m4m-focus-ring-dark` (`#ffd4dc`) on the aubergine ground,
  `--m4m-focus-ring-light` (`#dc1e3c`) on ivory. Use `focusRing[ground]` from
  `components/m4m`. Never `outline: none` without a replacement.
- **Targets**: 44px minimum; pad the hit area rather than growing the visual.
- **State is never colour alone**: a status has a word, an error has a
  message, the current nav item has `aria-current` and a marker.
- **Structure**: one `h1`, ordered headings, `nav`/`main`/`section` landmarks
  with labels, real `button` and `a` elements.
- **Zoom**: pinch-zoom stays enabled; text must survive 200%.
- **Names**: member names are user content. Allow them to wrap
  (`overflow-wrap: anywhere`), never truncate a name in a heading, and expect
  diacritics.

## 8. Do / don't

| Do | Don't |
| --- | --- |
| `<PrimaryButton>Send interest</PrimaryButton>` beside `<QuietButton>Save for later</QuietButton>` | Two rose gradient buttons in one row, each with a rose glow |
| `<StatusWord tone="verified">Verified</StatusWord>` | A green-tinted pill with a shield icon and "✓ ID Verified" |
| `<Surface>` with a `Hairline` between two groups | `bg-white/[0.04] backdrop-blur-sm rounded-3xl shadow-[…]` wrapping another card |
| `<Kicker>Membership</Kicker>` then a serif heading | A rose/gold gradient headline |
| `text-m4m-fg-muted` for a note | `text-white/40` |
| `bg-m4m-ground` | Three animated blurred blobs behind the page |
| "Your profile is with our team." | "🎉 Awesome! You're all set!" |
| A member's name in the display serif at 18px, weight 500 | A name in bold caps |
| `rounded-m4m-md` | `rounded-[22px]`, `rounded-3xl` |

## Roll-out

Ranked by distance from the system × visibility. S ≈ under a day, M ≈ 1–2
days, L ≈ 3+ days. Each page is a self-contained change: swap hand-written
values for tokens and primitives, then remove the listed anti-patterns.

| # | Page | Size | Fix |
| --- | --- | --- | --- |
| 1 | `(app)/profile/[id]` (another member's profile) | M | The only **light** page inside the dark shell (`#fdfbf9` ground, white cards, `shadow-luxe`, rose-100 borders, emerald/rose tinted pills, gold gradient badge, `rounded-3xl`). Move to the ground + `Surface`; one rose action ("Send interest"); `StatusWord` for verified; no focus styles at all today |
| 2 | `(app)/dashboard` ("My Matches") | M | Three animated aurora blobs, dot grid and vignette; 9 `backdrop-blur` cards; rose glow shadows (`rgba(220,30,60,.6)`); rose→gold gradient bar; 34/40px title; `rounded-2xl`/`3xl`/`[22px]`; tinted alert pills; no focus styles |
| 3 | `(app)/matches` (Browse) | M | Same aurora backdrop; 4 rose gradient buttons/counters per view; glass empty states; glow shadows; filter controls need the input pattern; 16 white-fill fragments |
| 4 | `(app)/subscription` | M | Gradient text headline; aurora; gradient-bordered "featured" tier with a 70px rose glow; 3 rose actions; `rounded-[26px]`; gold radial blob. Plans become `Surface tone="gold"` with one primary |
| 5 | `(app)/interests` | M | 77 inline style objects on legacy `--font-poppins`/`--font-playfair`; a rose gradient button on every row (many per view); amber/green tinted pills; 4 sub-AA text colours; 20px pill radii; no focus styles |
| 6 | `(app)/messages`, `messages/[id]` | M | Aurora; glass; rose gradient on send, counters and bubbles; 7 sub-AA text uses; composer needs the input pattern |
| 7 | `(app)/profile/me` + `_components` (largest file, 2,105 lines) | L | 250+ inline style objects across page, PhotoGrid, PartnerPrefsVisual, CompletionStrip; 5 rose gradients; rose→gold progress gradient; light modals (white) over the dark page; ad-hoc radii and shadows. Do it section by section |
| 8 | `(app)/settings` | L | 85 inline styles and a page-local button/panel CSS system (`.m4m-set-*`) to replace with primitives; two radial blobs; a second red (`#ef4444`) for destructive actions; `box-shadow 0 10px 30px` on panels |
| 9 | `(app)/notifications` | S | Legacy font vars; 4 rose gradients (dots, counters, button); 4 sub-AA text uses; no focus styles |
| 10 | `onboarding` | L | 1,652 lines, 67 inline styles; light/dark split layout with its own type sizes (36px clamp) and input styling; 3 rose gradients. First impression for every new member, so worth doing carefully after the input primitive exists |
| 11 | `auth/login`, `AuthShell`, forgot/reset | M | Same split layout as onboarding; own focus colours; own greens (`#3f5937`, `#5c7a52`); 40px title. Migrate with onboarding |
| 12 | `page.tsx` (home) | L | Light ivory ground is right for marketing. Fix: 3 gradient-text uses, drifting/aura decoration, cream/gold floating-header buttons (`#FFE4A8→#FFB347`, a fourth accent), 109 inline styles, no focus styles; adopt `ground="light"` primitives |
| 13 | `PublicHeader` / `.m4m-nav` + top bar (every public page) | M | Animated red gradient announcement bar with shine sweep and beating gem; register button with sheen, glow and pulsing heart; logo tilt on hover; blur on scroll. Make the public bar match the app bar's restraint |
| 14 | `pricing` | M | 56 inline styles; own clamp type scale; rose used for decoration; should share the plan pattern with subscription (#4) |
| 15 | `about`, `success-stories`, `contact`, `faq`, `profiles` | M (together) | Consistent with each other already (ivory `#fdf9f4`/`#faf3eb`, italic accent). Tokenise, add focus styles (none today on four of them), replace `#888`/`#aaa` text |
| 16 | `terms`, `privacy` | S | Own dark gradient header (`#1a0a14→#2d0f20`), `#fdfbf9` ground, legacy font vars; no focus styles |
| 17 | `PublicFooter`, `error`, `not-found`, `global-error`, `coming-soon`, `upgrade-lock` | S | 5 sub-AA text colours in the footer; glass and gradient in `upgrade-lock`; own shadows |
| 18 | `components/ui/luxe-button`, `profile-card`, `heart-button`, `floating-hearts`, `tilt-3d` | S | Retire in favour of `components/m4m` once nothing imports them (sheen, glow, 3D tilt, floating hearts are all anti-patterns). `profile-card` becomes the one member-card pattern, on `Surface` |
| 19 | Legacy CSS in `globals.css` (`.gold-text`, `.ring-rose-glow`, `.glass-rose`, `.aura-*`, `.heart-particle`, `.shadow-luxe`, `.warm-card`, `.btn-gold`…) and legacy Tailwind keys (`ruby`, `navy`, `rose`, `blush`, `shadow-card`…) | S | Delete each once its last user is migrated. The `ruby`/`navy` palette comment in `tailwind.config.ts` describes a navy brand colour that no member page uses |

Not in scope of this system: the admin console (`app/admin`,
`components/admin`), which has its own shadcn-based tokens and motion presets.
It inherits the two typefaces through the shared font tokens.
