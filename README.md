# TomDesk

A production-grade, real-time collaborative tutoring whiteboard built for high-FPS stylus input, side-by-side PDF annotation, visual area snipping, and persistent multi-student workspaces.

![Next.js](https://img.shields.io/badge/Next.js-15%20App%20Router-000000?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%C2%B7%20Storage%20%C2%B7%20Realtime-3ECF8E?style=flat-square&logo=supabase&logoColor=white)

---

## Features

### Access Control & Student Workspaces
- **Single Shared Hub PIN Gate:** Server-verified via `POST /api/auth/verify-pin` against `HUB_PIN` (constant-time `SHA-256` comparison with per-IP rate limiting). Issues a 30-day `HttpOnly`, `SameSite=Lax`, `HMAC-SHA256` signed session cookie enforced by `src/middleware.ts`.
- **Dedicated Student Workspaces:** Top-level navigation and direct routes for **Isla** (`/isla`), **India** (`/india`), and **Ivy** (`/ivy`), plus a Hub overview at `/`.
- **Board Management Sidebar:** Collapsible sidebar ordered by `updated_at DESC` with **+ New Board**, real-time title search, inline double-click renaming, and confirmation-gated deletion that cleans up associated PDFs and snips from Supabase Storage.

### High-Performance Canvas & Stylus Engine
- **60–120fps Dual-Canvas Rendering:** Decouples active drawing from React state updates using `requestAnimationFrame`, `PointerEvent.getCoalescedEvents()`, `perfect-freehand`, and full `devicePixelRatio` Retina scaling.
- **Hardware Stylus Support:** Supports Wacom/XPPen variable pressure, barrel/tail eraser detection, touch pinch-to-zoom, wheel zoom, and `Space + Drag` / middle-click panning.
- **Full Toolset:**
  - **Pen (`P`):** Pressure-sensitive ink with Black, Navy, Crimson, Emerald, and Royal Blue presets + 4 stroke widths.
  - **Highlighter (`H`):** Semi-transparent chisel strokes using `multiply` blending so underlying PDF text stays sharp.
  - **Eraser (`E`):** Instant stroke and shape eraser with live cursor ring preview.
  - **Select / Transform (`V`):** Move, scale, lock/unlock, z-order, duplicate (`Cmd/Ctrl + D`), and delete objects or marquee selections.
  - **Shapes & Lines (`R` / `L`):** Lines, arrows, rectangles, and circles (`Shift` snaps lines to 15° increments and boxes/ellipses to squares/circles).
  - **History & Export:** 100-step multiplayer-synced Undo/Redo and **Export Board** as a 2x Retina PNG or multi-page PDF.

### Paper Templates, Side-by-Side PDFs & Visual Area Snip
- **+ Add Paper Templates:** One-click A4 **Blank**, **Lined** (college-ruled with margin), **Graph / Grid**, and **Dot Grid** sheets placed automatically side-by-side next to active sheets or PDFs.
- **PDF Upload & Annotation:** Drag-and-drop or pick `.pdf` files, uploaded to Supabase Storage (`board-assets`) and rendered at `2.5x` DPI via `pdfjs-dist` (using a self-hosted worker in `public/pdf.worker.min.mjs`) as locked/selectable background sheets.
- **Visual Area Snip (`S`):** Box crop or freehand lasso captures all visible layers (PDF pages + ink + paper grids) at full Retina resolution into a PNG blob, copies it to your system clipboard, uploads it to `board-assets/snips/...`, inserts the offset cutout onto the canvas, and automatically switches back to **Select (`V`)** for placement onto scratch paper.

### Real-Time Two-Way Sync & Auto-Save
- **Supabase Realtime (`src/hooks/useRealtimeBoard.ts`):** Scoped per `board_id` with **Presence** (displays a pulsing green **Live** pill when tutor and student are connected) and **30Hz Broadcast** for live in-progress strokes, peer cursors, and committed scene patches.
- **Resilient Persistence:** `1.5s` debounced PostgreSQL auto-save with `Saved`, `Saving...`, and `Offline — Retrying` status indicators and automatic exponential-backoff retry on network drops.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `P` | Pen tool |
| `H` | Highlighter tool |
| `E` | Stroke / Shape Eraser |
| `V` | Select / Transform tool |
| `R` / `L` | Rectangle / Line tool (hold `Shift` to snap) |
| `S` | Visual Area Snip (Box Crop / Freehand Lasso) |
| `Space + Drag` / Middle-Click | Pan infinite canvas |
| `Wheel` / Pinch | Zoom canvas around cursor |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + D` | Duplicate selection |
| `Delete` / `Backspace` | Delete selection |
| `Esc` | Clear selection |

---

## Project Structure

```text
├── public/
│   └── pdf.worker.min.mjs          # Local pdfjs-dist worker (copied on postinstall/build)
├── scripts/
│   └── copy-pdf-worker.mjs         # Copies pdf.worker.min.mjs from node_modules
├── supabase/
│   └── schema.sql                  # Boards table, triggers, RLS, and board-assets bucket
├── src/
│   ├── app/
│   │   ├── api/auth/
│   │   │   ├── logout/route.ts     # Clears session cookie
│   │   │   └── verify-pin/route.ts # Server-side HUB_PIN check & cookie issuance
│   │   ├── india/page.tsx          # /india workspace
│   │   ├── isla/page.tsx           # /isla workspace
│   │   ├── ivy/page.tsx            # /ivy workspace
│   │   ├── pin/page.tsx            # Shared Hub PIN gate
│   │   ├── layout.tsx
│   │   └── page.tsx                # Authenticated Hub home
│   ├── components/
│   │   ├── auth/                   # PinGateForm
│   │   ├── canvas/                 # WhiteboardCanvas, FloatingToolbar, PaperTemplateMenu, etc.
│   │   ├── sidebar/                # BoardSidebar, DeleteBoardDialog
│   │   └── workspace/              # StudentWorkspace, WorkspaceHeader
│   ├── hooks/
│   │   ├── useBoards.ts            # Board CRUD, search, and ordering
│   │   └── useRealtimeBoard.ts     # Supabase Broadcast, Presence, and debounced save
│   ├── lib/
│   │   ├── auth.ts                 # Edge-safe Web Crypto HMAC session & PIN utilities
│   │   ├── canvas/                 # Geometry, renderer, pdfRenderer, exporter
│   │   ├── supabase/               # Browser client, board queries, storage cleanup
│   │   └── utils.ts
│   ├── types/
│   │   ├── board.ts
│   │   └── scene.ts
│   └── middleware.ts               # Enforces session cookie across app & API routes
├── .env.example
└── next.config.ts
```

---

## Quick Start

### 1. Prerequisites
- **Node.js 20+** (Node 22 LTS recommended)
- A **Supabase** project (Free tier works)

### 2. Install Dependencies
```bash
npm install
```
`postinstall` automatically copies `pdf.worker.min.mjs` into `public/` so PDF rendering works without external CDN dependencies.

### 3. Initialize Supabase Database & Storage
1. Open your Supabase dashboard and go to **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   - Creates `public.boards`, indexes, `updated_at` trigger, RLS policies, and the `board-assets` storage bucket (`50 MB` file limit for PDFs and snips).

### 4. Configure Environment Variables
Copy the template and create `.env.local`:
```bash
cp .env.example .env.local
```

Generate a 32+ character `SESSION_SECRET`:
```bash
openssl rand -hex 32
```

Fill in `.env.local`:

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase **Publishable** (`sb_publishable_...`) or legacy **`anon` public** key (never use the `secret` or `service_role` key) |
| `HUB_PIN` | Shared PIN code you choose to lock the hub (server-only) |
| `SESSION_SECRET` | Random secret used to HMAC-sign the 30-day session cookie (server-only) |

### 5. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000), enter your `HUB_PIN`, and select **Isla**, **India**, or **Ivy**.

---

## Deploying to Vercel

1. Push this repository to a private GitHub repository.
2. Import the repository in **Vercel → Add New Project**.
3. Add the four environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `HUB_PIN`, `SESSION_SECRET`) in **Project Settings → Environment Variables**.
4. Deploy and share your Vercel URL and `HUB_PIN` with your students.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Sync PDF worker and create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run typecheck` | Run `tsc --noEmit` TypeScript strict verification |
