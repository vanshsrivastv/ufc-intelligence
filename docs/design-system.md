# UFC Intelligence — Design System
**Concept: Premium Black + Gold Luxury**

This is the single source of truth for every visual decision in the app. If a component doesn't match a rule here, the rule wins — fix the component, don't bend the system.

---

## 1. Color Tokens

Define these as CSS custom properties (or Tailwind theme extensions) — never hardcode hex values in components.

```css
:root {
  /* Base surfaces */
  --color-bg-primary:      #0A0A0B;  /* app background */
  --color-bg-elevated:     #141412;  /* cards, panels */
  --color-bg-elevated-2:   #1C1C19;  /* nested cards, table row hover */
  --color-bg-overlay:      rgba(10, 10, 11, 0.85); /* modal backdrop */

  /* Gold accent ramp */
  --color-gold-100:        #F5E6C8;  /* rare — text on gold fills */
  --color-gold-300:        #E8C572;  /* primary accent, active states */
  --color-gold-500:        #C9A050;  /* borders, secondary accent */
  --color-gold-700:        #8A6A2F;  /* muted gold, disabled accent */
  --color-gold-900:        #3C2F14;  /* hairline borders on dark */

  /* Text */
  --color-text-primary:    #F2F0EA;
  --color-text-secondary:  #B4B2A9;
  --color-text-muted:      #8C8A82;  /* lightened from #6E6C63 - that failed WCAG AA against every dark surface */
  --color-text-on-gold:    #1A1408;  /* dark text when placed on gold fill */

  /* Semantic (used sparingly — never decorative) */
  --color-live:            #A32D2D;  /* "LIVE" indicator only */
  --color-success:         #4E7A4A;  /* win-rate positive delta */
  --color-danger:          #A32D2D;  /* loss / negative delta */

  /* Borders */
  --color-border:          #2A2620;  /* default hairline */
  --color-border-strong:   #3C2F14;  /* gold-tinted, emphasis */
}
```

**Rule:** gold appears on no more than ~10% of any given screen's surface area. It marks *the one important thing* — an active nav item, a rank number, a CTA, a live indicator. If a screen has gold everywhere, it stops meaning anything.

---

## 2. Typography Scale

| Token | Font | Size | Weight | Use |
|---|---|---|---|---|
| `display-lg` | Serif display (e.g. Canela / Fraunces) | 48px | 500 | Hero headlines, event countdown numerals |
| `display-md` | Serif display | 32px | 500 | Section headers, fighter name on profile |
| `heading-lg` | Sans (Inter) | 24px | 500 | Page titles |
| `heading-md` | Sans | 18px | 500 | Card titles, subsection headers |
| `body-lg` | Sans | 16px | 400 | Primary body text |
| `body-md` | Sans | 14px | 400 | Secondary text, table cells |
| `caption` | Sans | 12px | 400 | Labels, metadata, timestamps |
| `stat-numeral` | Sans (tabular figures) | varies | 500 | Any displayed statistic — always tabular nums so columns align |

**Rule:** serif is reserved for identity moments (names, hero headlines, event titles). Every data point, table, and UI chrome element stays in sans. Mixing them signals which is content and which is interface.

---

## 3. Spacing System

8px base unit.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | icon-to-label gaps |
| `space-2` | 8px | tight internal padding |
| `space-3` | 12px | default component internal padding |
| `space-4` | 16px | card padding, form field spacing |
| `space-6` | 24px | section spacing within a page |
| `space-8` | 32px | major section breaks |
| `space-12` | 48px | hero/section vertical rhythm |
| `space-16` | 64px | landing page section separation |

---

## 4. Grid

- Desktop: 12-column grid, 1440px max content width, 24px gutters, 64px outer margin.
- Tablet: 8-column grid, 16px gutters, 32px outer margin.
- Mobile: 4-column grid, 16px gutters, 16px outer margin.
- Breakpoints: `mobile <640px`, `tablet 640–1024px`, `desktop >1024px`, `wide >1440px`.

---

## 5. Border Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 2px | badges, small tags |
| `radius-md` | 4px | buttons, inputs, table cells |
| `radius-lg` | 8px | cards, panels |
| `radius-full` | 999px | avatars, pill badges |

**Rule:** this concept reads as sharp and precise, not soft. Default to `radius-md` for most components — avoid the temptation to round everything to 12px+, which drifts toward the "Apple glass" concept we didn't pick.

---

## 6. Elevation & Shadows

No drop shadows on dark backgrounds — they're invisible or muddy. Elevation is communicated by:
1. **Background step** — `--color-bg-elevated` sits one step lighter than `--color-bg-primary`.
2. **Border** — 1px `--color-border`, or `--color-border-strong` for emphasized/hovered cards.
3. **Gold edge glow on hover only** (interactive cards) — `box-shadow: 0 0 0 1px var(--color-gold-500), 0 0 12px rgba(201,160,80,0.15)`.

Modals/overlays: `--color-bg-overlay` backdrop, modal surface at `--color-bg-elevated-2` with a 1px `--color-border-strong` edge.

---

## 7. Icons

Outline-style icon set only (never filled) — thin 1.5px stroke, matches the precision feel of the concept. Default color `--color-text-secondary`; active/selected state switches to `--color-gold-300`. Icon sizes: 16px inline, 20px standalone, 24px navigation.

---

## 8. Buttons

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `--color-gold-300` | `--color-text-on-gold` | none | one per screen, max — the single most important action |
| Secondary | transparent | `--color-text-primary` | 1px `--color-border-strong` | default action button |
| Ghost | transparent | `--color-text-secondary` | none | tertiary/dismissive actions |
| Danger | transparent | `--color-danger` | 1px `--color-danger` | destructive actions only |

States: hover lightens background 8%, active scales to 0.98, disabled drops to 40% opacity with no hover response. Height: 40px (default), 32px (compact/table-inline), 48px (hero CTA).

---

## 9. Inputs / Dropdowns

- Background `--color-bg-elevated`, 1px `--color-border`, `radius-md`.
- Focus state: border switches to `--color-gold-500`, no glow/ring (keep it crisp, not soft).
- Placeholder text: `--color-text-muted`.
- Dropdowns share input styling; open panel is `--color-bg-elevated-2` with 1px `--color-border-strong`.

---

## 10. Tables

- Row height: 44px default, 36px compact (rankings tables with many rows).
- Header row: `caption` typography, `--color-text-secondary`, bottom border `--color-border-strong`.
- Row hover: background steps to `--color-bg-elevated-2`.
- Numeric columns: right-aligned, tabular figures, always.
- Sort-active column header: `--color-gold-300` text + small triangle indicator.

---

## 11. Charts

- Line/bar fills: `--color-gold-300` for primary series, `--color-text-secondary` (desaturated) for comparison series — never more than 2 colors per chart.
- Gridlines: `--color-border`, 1px, horizontal only (no vertical gridlines on time-series).
- Axis labels: `caption` size, `--color-text-muted`.
- Positive/negative deltas use `--color-success` / `--color-danger` — the only place outside gold/live where color carries meaning.
- Radar charts (style comparison) use a single gold stroke with 10% fill opacity.

---

## 12. Badges

- Rank badge: gold-filled pill, `--color-text-on-gold`, serif numeral for #1–3, sans for the rest.
- Status badges (e.g. "Champion", "Interim"): `--color-gold-900` background, `--color-gold-300` text, `radius-sm`.
- "LIVE" badge: `--color-live` fill, white text, subtle pulse animation (opacity 1 → 0.7 → 1, 1.5s loop) — the only looping animation permitted anywhere in the system.

---

## 13. Cards

- Default: `--color-bg-elevated`, 1px `--color-border`, `radius-lg`, `space-4` padding.
- Interactive/hoverable card (e.g. fighter card, event card): border transitions to `--color-gold-500` on hover with the edge-glow shadow described in §6.
- Fighter photo cards: photo bleeds to card edges top/sides, stats block below with `space-4` padding — photo never gets rounded corners cropped in, the card radius clips it.

---

## 14. Dialogs / Notifications

- Dialogs: centered, `--color-bg-elevated-2`, max-width 480px (standard) / 640px (data-heavy, e.g. fight comparison), `radius-lg`, backdrop `--color-bg-overlay`.
- Toast notifications: bottom-right stack, `--color-bg-elevated`, 1px `--color-border-strong`, auto-dismiss 4s, slide-in from bottom (200ms ease-out).

---

## 15. Forms

- Label above field, `caption` typography, `--color-text-secondary`.
- Required field marker: small gold asterisk, not red.
- Validation error: field border switches to `--color-danger`, helper text below in `--color-danger`, `caption` size.
- Never use placeholder text as a label substitute.

---

## 16. Skeletons / Loading States

- Skeleton blocks: `--color-bg-elevated` base with a subtle shimmer sweep in `--color-gold-900` at 20% opacity, 1.5s loop, left-to-right.
- Full-page loads: centered gold pulse dot (8px), no spinner icon — spinners read as generic/cheap against this concept's restraint.

---

## 17. Empty / Error States

- Empty state: centered icon (24px, `--color-text-muted`) + `heading-md` message + `body-md` supporting text + secondary-style button if an action applies. No illustration/mascot — stays consistent with the serious, premium tone.
- Error state: same layout, icon and message in `--color-danger`, always paired with a retry action.

---

## 18. Responsive Rules

- Navigation: top bar collapses to a bottom tab bar below 640px (5 items max: Home, Events, Rankings, Search, Profile).
- Fighter photo panels: full-bleed top-of-screen on mobile (4:5 crop) rather than side-by-side with stats.
- Tables: horizontal scroll with a frozen first column (fighter name) below 640px — never stack table rows into cards, it destroys comparability.
- Hero sections: serif display type drops one scale step per breakpoint down (`display-lg` 48px → 36px tablet → 28px mobile).

---

## 19. Accessibility

- Minimum contrast: body text on `--color-bg-primary` must hit WCAG AA (4.5:1) — `--color-text-primary` (#F2F0EA) against #0A0A0B passes comfortably; verify `--color-text-secondary` and `--color-gold-500` on every new background combination, since gold-on-dark is the riskiest pairing in this system.
- Never convey state (live, error, rank change) by color alone — always pair with an icon or text label.
- All interactive elements need a visible focus state (gold border, no reliance on browser default outline which is invisible on dark backgrounds).
- Motion: respect `prefers-reduced-motion` — disable shimmer/pulse loops and reduce transition durations to near-instant for users who request it.

---

## 20. Animation

- Standard transition: 250–350ms, ease-out. Nothing bounces or overshoots — this concept is deliberate, not playful.
- Page transitions: simple fade + 8px upward slide, 300ms.
- Number count-ups (stat reveals): 600ms ease-out, only on first view of a stat block (not on every re-render).
- The only looping animations in the entire system: the "LIVE" badge pulse and the skeleton shimmer. Everything else is a one-shot on state change.

---

*Next: Phase 4 — System Architecture. This design system is the contract every component in the codebase must satisfy; once you're ready, I'll move into database design, folder structure, API architecture, and the full tech stack selection with reasoning for each choice.*
