# Design System — IbbulAI

This document covers the visual design decisions, color system, typography, and component patterns.

---

## Brand Identity

IbbulAI is the official digital assistant for Ibrahim Badamasi Babangida University, Lapai. Every design decision reflects the university's identity — official, trustworthy, and accessible.

---

## Color Palette

### Primary — IBB University Green

| Token | Value | Usage |
|---|---|---|
| Primary | `#1A6B1A` | Buttons, active states, links, nav bar, headers |
| Dark | `#155715` | Hover states, pressed buttons |
| Light | `#e8f5e8` | Backgrounds, badges, tags, guest banner |
| Mid | `#c8e6c8` | Borders, dividers, suggestion chips |

### Semantic Colors

| Token | Value | Usage |
|---|---|---|
| Success | `#2E7D32` | Confirmations |
| Warning | `#F9A825` | Caution messages |
| Error | `#D32F2F` | Errors, destructive actions |
| Info | `#1565C0` | Informational states |

### Neutrals

| Token | Value | Usage |
|---|---|---|
| Page background | `#f5f5f5` | App background |
| Surface | `#ffffff` | Cards, panels, forms |
| Chat background | `#fafafa` | Messages area |
| Border | `#e0e0e0` | Dividers, input borders |
| Text | `#1a1a1a` | Primary text |
| Text 2 | `#4a4a4a` | Secondary text |
| Text 3 | `#888888` | Placeholders, muted |

---

## Typography

| Role | Font | Weight |
|---|---|---|
| Headings / Display | Space Grotesk | 500–700 |
| Body / UI | Inter | 400–600 |

### Scale
```
10px — timestamps, labels, micro text
11px — captions, helper text
12px — secondary content, table cells
13px — body, nav items, card text, chat prose
14px — primary body (text-sm)
15px — lead text
18–24px — section headings
28–48px — page / hero headings
```

---

## Chat Message Layout

### Bot messages (Claude-style prose)
- IBBU logo avatar (left, 32×32, rounded-full)
- No bubble border or background
- Full-width prose text with markdown rendering
- Copy button appears on hover (top-right)
- Suggestion chips below response

### User messages (green bubble)
- "You" avatar (right, 32×32, #1A6B1A)
- Green bubble (`#1A6B1A`), `rounded-2xl rounded-tr-none`
- Max width 80% on mobile, 70% on desktop
- Right-aligned

### Markdown rendering (custom parser in MessageBubble.tsx)
| Markdown | Output |
|---|---|
| `## Heading` | `<h2>` — 15px bold |
| `### Heading` | `<h3>` — 14px semibold |
| `**bold**` | `<strong>` |
| `*italic*` | `<em>` |
| `1. item` | `<ol>` numbered list |
| `- item` | `<ul>` bullet list |
| `> note` | `<blockquote>` green left border |
| `---` | `<hr>` divider |
| blank line | spacing div |

---

## Empty Chat State

- Centered in the messages area
- IBBU logo (64×64, rounded-full, green border)
- Time-based greeting (`Good morning/afternoon/evening, [Name]`)
- Role subtitle for logged-in users
- Fades out with `opacity-0 -translate-y-4` transition when first message is sent

---

## Auth Pages Layout

All auth pages share the same two-panel layout:

- **Left panel** (desktop only, `w-[420px]`): `#1A6B1A` background, IBBU logo, role icon, text
- **Right panel**: white form, centered, max-width 448px

On mobile: left panel hidden, compact logo header shown instead.

---

## Sidebar

```
Width:      240px fixed (desktop), slide-in drawer (mobile)
Background: #1A6B1A
Active nav: bg-white/20 text-white
Inactive:   text-white/75 hover:bg-white/10
```

### Visibility rules by role

| Section | Guest | Student | Staff | Admin |
|---|---|---|---|---|
| Main Menu | ✅ | ✅ | ✅ | ✅ |
| Staff Portal link | ✅ | ❌ | ❌ | ❌ |
| Admin Login link | ✅ | ❌ | ❌ | ❌ |
| Staff Panel link | ❌ | ❌ | ✅ | ❌ |
| Dashboard link | ❌ | ❌ | ❌ | ✅ |
| User info card | ❌ | ✅ | ✅ | ✅ |
| Sign out | ❌ | ✅ | ✅ | ✅ |

---

## Admin vs Staff Panel

| Tab | Admin | Staff |
|---|---|---|
| Overview (stats + charts) | ✅ | ❌ |
| Chat Logs | ✅ | ❌ |
| Documents | ✅ | ✅ |
| Knowledge Base | ✅ | ✅ |
| Settings | ✅ | ❌ |

---

## Settings Persistence

Settings are stored in the `system_config` PostgreSQL table. The admin UI shows current active values loaded from DB. On save, `POST /api/admin/settings` is called, which writes to DB and updates the in-memory config cache immediately. No server restart required.

---

## Scrollbar

```css
width: 4px (2px on mobile)
thumb: #d1d5db → #9ca3af on hover
track: transparent
border-radius: 100px
```

---

## Motion

| Animation | Duration | Usage |
|---|---|---|
| `msgSlideIn` | 200ms | New chat messages |
| `fadeIn` | 200ms | Page transitions |
| `slideUp` | 250ms | Bottom sheet modals |
| `typingBounce` | 1.2s∞ | Typing indicator |
| `animate-pulse` | 2s∞ | Online status dot |
| `animate-ping` | 2s∞ | Hero logo glow |
| Empty state fade-out | 300ms | Greeting disappears on first message |

---

## Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|---|---|---|
| Mobile | < 640px | Sidebar drawer, single column, full-screen chat |
| Tablet | 640–1024px | Two columns, collapsible sidebar |
| Desktop | > 1024px | Sidebar always visible, multi-column grids |

---

## Design Principles

1. **Official IBBU branding** — `#1A6B1A` and white throughout, IBBU logo everywhere
2. **Light mode only** — no dark mode per institutional requirements
3. **Mobile-first** — designed for phones, enhanced for desktop
4. **Rich formatting** — markdown responses feel like a real academic advisor
5. **Role clarity** — every interface clearly shows what role the user is
6. **Persistence** — settings and user data survive page refreshes
