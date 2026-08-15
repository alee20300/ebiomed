# eBiomed Design System

**Status:** canonical reference · supersedes the token sections of `docs/superpowers/specs/2026-05-09-ebiomed-design-system-design.md`
**Verified against:** commit `332d40f` — `src/app/globals.css`, `src/components/ui/`, `src/lib/utils/format.ts`

This is not a new visual direction. The OKLCH + blue + 8px-radius language from the 2026-05-09 spec stands. This document records that language as it is *actually implemented*, fills the two gaps where shipped code had drifted from the spec, and lists the remaining drift as work.

Precedence when these conflict: this file > `2026-05-09-ebiomed-design-system-design.md` > ad-hoc component classes.

---

## 1. What already changed in code

Two changes have landed. Do not re-implement them.

| File | Change |
|------|--------|
| `src/app/globals.css` | Added the semantic tone scale (§3) to `:root` and `.dark`, exposed through `@theme inline`. Additive only — no existing token changed. |
| `src/lib/utils/format.ts` | Added `statusTone()` / `priorityTone()` / `toneClasses()`. `statusColor()` and `priorityColor()` keep their signatures but now resolve through tones, so no raw palette classes are emitted. |
| `src/lib/utils/__tests__/format.test.ts` | Rewritten to assert tone semantics rather than exact palette strings, plus a regression guard against raw palette output. |

`npx tsc --noEmit` and `npx vitest --run` are clean as of this commit.

---

## 2. Foundations

Colour is OKLCH for perceptual uniformity. Neutrals carry a deliberate blue bias (hue 240–250) — there is **no pure grey** in the system, and a `gray-*` class is always wrong.

### Surface & ink (unchanged, `:root`)

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `oklch(98% 0.005 250)` | `oklch(15% 0.02 240)` |
| `--card` | `oklch(100% 0 0)` | `oklch(20% 0.02 240)` |
| `--muted` | `oklch(97% 0 0)` | `oklch(25% 0.02 240)` |
| `--foreground` | `oklch(22% 0.02 240)` | `oklch(98% 0.005 250)` |
| `--muted-foreground` | `oklch(50% 0.018 240)` | `oklch(65% 0.02 240)` |
| `--border` / `--input` | `oklch(90% 0.008 240)` | `oklch(30% 0.02 240)` |

### Accent

`--primary` / `--ring` = `#2563eb` light, `#3b82f6` dark.

One accent, reserved for: primary actions, active nav state, focus rings, links. It is **not** available for emphasis, decoration, or as a status colour.

---

## 3. Semantic tones (the gap the spec left open)

The 2026-05-09 spec called for `--success` / `--warning` / `--danger` / `--info` but they were never added to `globals.css`. They now exist, with three roles each — the roles are not interchangeable:

- **`base`** — solid fills, icons, chart marks
- **`subtle`** — background only
- **`strong`** — text or icons sitting on `subtle`

```
--success / --success-subtle / --success-strong
--warning / --warning-subtle / --warning-strong
--danger  / --danger-subtle  / --danger-strong
--info    / --info-subtle    / --info-strong
            --neutral-subtle / --neutral-strong
```

Tailwind classes follow directly: `bg-success-subtle`, `text-success-strong`, `border-danger`, etc.

### Measured contrast (WCAG 2.1, subtle/strong pair)

| Tone | Light | Dark |
|------|-------|------|
| success | 7.9:1 | 8.6:1 |
| warning | 6.6:1 | 8.6:1 |
| danger | 7.1:1 | 7.3:1 |
| info | 6.0:1 | 8.4:1 |
| neutral | 8.2:1 | 7.9:1 |

All ten pairs clear AA; eight clear AAA. **If you change a token value, re-measure** — don't assume.

---

## 4. Domain mapping

Nineteen status strings collapse onto five tones. That collapse is the point: it is what makes a dense table scannable. The mapping is single-sourced in `src/lib/utils/format.ts` and unknown values fall through to `neutral`, so a new status ships grey rather than broken.

| Entity | Status | Tone |
|--------|--------|------|
| Work order | `open` | info |
| Work order | `in_progress`, `on_hold` | warning |
| Work order | `completed` | success |
| Work order | `cancelled` | neutral |
| Complaint | `new`, `pending_review` | warning |
| Complaint | `triaged`, `converted` | info |
| Complaint | `approved` | success |
| Complaint | `rejected` | danger |
| Equipment | `active` | success |
| Equipment | `inactive` | neutral |
| Equipment | `under_repair` | warning |
| Equipment | `retired` | danger |
| Calibration | `certified` | success |
| Calibration | `out_of_tolerance` | danger |

Priority escalates monotonically: `low` → neutral, `medium` → info, `high` → warning, `critical` → danger.

Two deliberate semantic collapses, previously distinct hues: `under_repair` was purple (now warning — it is an attention state), `triaged` was indigo (now info).

---

## 5. Typography

One family: the system sans stack. No webfont ships. `--font-heading` is currently an alias of `--font-sans` — headings differ by weight and size, not family. Mono (`--font-mono`) is reserved for identifiers: asset tags, serial numbers, reference codes.

| Token | Size | Role | Occurrences in `src/` |
|-------|------|------|----------------------|
| `text-2xl` | 24px | Page titles | 43 |
| `text-xl` | 20px | Section headings | 7 |
| `text-lg` | 18px | Subsection headings | 19 |
| `text-base` | 16px | Card titles | 13 |
| `text-sm` | 14px | Body, table cells, labels — the default | 352 |
| `text-xs` | 12px | Badges, metadata, timestamps | 219 |

`text-sm` and `text-xs` carry 89% of the interface. That distribution *is* the design — this is a dense operational tool. Nothing above `text-2xl` is in the scale.

---

## 6. Radius & elevation

Root `--radius: 0.5rem` generates the scale. In practice: `rounded-lg` (8px) for nearly everything (185 uses), `rounded-md` (6px) for small nested controls (64), `rounded-full` for badges and avatars (28).

**Depth is carried by borders, not shadows.** There is exactly one shadow in the system — `0 1px 2px 0 rgb(0 0 0 / 0.05)` on cards. Dialogs and popovers separate by overlay and border. Do not introduce a second elevation level.

---

## 7. Primitives

All wrap Base UI, styled with `class-variance-authority`. **A variant name is the contract** — extend a `cva` variant in `src/components/ui/` rather than passing long `className` overrides at call sites.

`Button` is the most connected node in the codebase (62 edges); changes propagate everywhere.

### Button

Variants: `default` (solid accent), `outline`, `secondary`, `ghost`, `destructive`, `link`.
Sizes: `xs` 24px, `sm` 28px, `default` 32px, `lg` 36px, plus `icon` / `icon-xs` / `icon-sm` / `icon-lg`.

Controls run small deliberately, to keep table rows and toolbars dense. **Never more than one `default` (primary) button per view.**

### Input

36px tall, `bg-card` not `bg-background` — inputs sit *above* the page ground. Focus draws a 2px inset accent outline rather than a ring, so alignment in dense forms doesn't shift.

### Card

Compound: `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` / `CardAction`. A `size="sm"` prop tightens padding via container queries — do not fork a separate small-card component. Footers get the sunken tint and top border automatically.

### Badge

Base geometry: `rounded-full`, `h-5`, `px-3`, `text-xs font-medium`.

---

## 8. App shell

Defined in `src/app/(app)/layout.tsx`. Navigation is role-aware — the same shell renders different items for admin, technician, viewer.

| Region | Breakpoint | Treatment |
|--------|-----------|-----------|
| Sidebar | `lg`+ | 256px, `bg-card`, right border. Active item `bg-primary/[0.08]` + accent text. |
| Header | all | 64px, `bg-card`, bottom border. Avatar menu right-aligned. |
| Bottom nav | below `lg` | Primary destinations + "More" sheet. Content reserves `pb-20` to clear it. |
| Content | responsive | Padding 16 → 24 → 32px at `sm` and `lg`. `bg-background`. |

---

## 9. Rules

1. **Never write a raw palette class.** `bg-green-100`, `text-gray-500` and friends ignore the theme and break in dark mode.
2. **Status colour comes from `statusTone()`, never from a component.** If a badge needs a colour the mapping doesn't produce, change the mapping — reviewed once — not the call site.
3. **One accent.** Blue means "primary action or current location". Nothing else.
4. **Semantic colour is never the only signal.** Every tone pairs with a text label; greyscale printouts and colour-blind users must still read correctly. This is a clinical-equipment tool — assume printouts.
5. **Borders before shadows.** New surfaces separate with `border-border`.
6. **Variants over class strings.**

---

## 10. Known drift — the implementation backlog

Recorded honestly so it can be worked down. This is the work, in priority order.

### 10.1 Raw palette classes: 487 occurrences across 58 files

325 `text-*`, 119 `bg-*`, 43 `border-*`. Every one is invisible or illegible in dark mode.

Highest leverage first:

| Current | Count | Replace with |
|---------|-------|--------------|
| `text-gray-500` | 120 | `text-muted-foreground` |
| `text-gray-400` | 35 | `text-muted-foreground` |
| `text-gray-600` | 13 | `text-muted-foreground` |
| `text-gray-900` | 10 | `text-foreground` |
| `bg-gray-50` | 35 | `bg-muted` |
| `bg-red-50` / `bg-red-100` | 30 | `bg-danger-subtle` |
| `text-red-800` / `text-red-600` | 31 | `text-danger-strong` |
| `border-red-200` | 12 | `border-danger` |

The three grey text classes alone are 168 occurrences — roughly a third of all drift, and a near-mechanical replacement. Start there.

Green / yellow / orange / blue clusters map onto `success` / `warning` / `info` by the same pattern. Check each in context: a few `text-gray-*` uses mean `text-foreground`, not muted.

### 10.2 Ten `teal-*` uses

Teal is not in the palette and has no token. Decide per case whether each means `info` or the accent, and record which.

### 10.3 `Badge` variants bypass the tokens

`success` / `warning` / `info` in `src/components/ui/badge.tsx` hardcode OKLCH literals and have **no dark-mode branch**. Only 3 call sites — fold them onto the tone tokens.

### 10.4 `StatusBadge` / `PriorityBadge` bypass `Badge`

`src/components/shared/status-badge.tsx` and `priority-badge.tsx` render a bare `<span>` with their own pill styling, so badge geometry lives in two places. Route them through `Badge`.

### 10.5 Dark mode is defined but unreachable

The `.dark` token block is complete and now includes the tone scale, but **nothing in the app ever sets the `dark` class** — no theme switcher, no `prefers-color-scheme` hook. Dark styling is therefore entirely untested in practice.

This needs a product decision before the drift work is worth much: either wire up a toggle, or drop the dark block. Fixing 487 classes for a mode nobody can reach is hard to justify on its own — though the same fixes are also correctness wins for the light theme, since tokens are what make the system coherent.
