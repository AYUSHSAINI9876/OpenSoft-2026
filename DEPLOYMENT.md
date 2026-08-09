# Oak Capital — Testing & Deployment Guide

## 0. The one thing to know before you start

**The frontend deploys to Vercel. The backend cannot.**

The Go backend links a C++ matching engine over CGO, holds an in-memory order
book, runs background market-simulation goroutines, and serves long-lived
WebSocket connections. Vercel's serverless runtime is stateless, freezes between
invocations, cannot hold WebSockets open, and does not support CGO-linked shared
libraries. Put the backend on a container host (Railway, Render, Fly.io, a VM —
its `Dockerfile` already exists) and point the Vercel frontend at it.

---

## 1. Test locally (fastest path)

### 1.1 Static checks — no services required

```bash
cd Opensoft-26-Frontend
npm ci
npm run typecheck     # tsc, must exit 0
npm test              # 28 unit tests: JWT expiry, session store, password policy
npm run build         # must print "✓ built"
```

```bash
cd Opensoft-26-Backend
go build ./...
go vet ./...
go test ./internal/api/... ./pkg/config/...   # 27 cases: CORS allowlist, JWT secret rules
```

> On a machine without a 64-bit C toolchain, prefix Go commands with
> `CGO_ENABLED=0`. The build-tag split (`cgo_bridge.go` / `mock.go`) swaps in a
> mock engine. Two tests in `internal/market` need the real C++ engine and will
> fail without CGO — that is expected, not a regression.

### 1.2 Full stack

```bash
# Terminal 1 — Postgres, Redis, Go API, C++ engine
cd Opensoft-26-Backend
cp .env.example .env          # set JWT_SECRET
docker compose up --build
# wait for: 🚀 Successfully connected to Database!

# Terminal 2 — frontend
cd Opensoft-26-Frontend
npm run dev                   # http://localhost:5173
```

Leave `VITE_API_BASE_URL` unset locally — `vite.config.ts` proxies `/api/v1`,
`/auth`, and `/ws` to `localhost:8080`.

---

## 2. Manual test script

Work through these in order. Each step states what correct behaviour looks like.

### Auth

| # | Action | Expected |
|---|--------|----------|
| 1 | Visit `/` signed out | Landing page renders |
| 2 | Go to `/signup`, type a weak password | Strength meter reads *Too weak*; checklist updates live |
| 3 | Submit with a 7-char password | Blocked client-side: "Password must be at least 8 characters" |
| 4 | Submit username `-bad-` | Blocked: hyphen rule message |
| 5 | Register a valid account | Toast: portfolio funded with $100,000; lands on `/portfolio` |
| 6 | Click the eye icon in a password field | Value toggles visible/hidden |
| 7 | Sign out from the navbar | Toast confirms; navbar flips to Log in / Sign up **without a page reload** |
| 8 | Visit `/portfolio` while signed out | Redirected to `/login` |
| 9 | Sign in from that redirect | Returns to `/portfolio`, not the default page |
| 10 | Sign in, then sign out in a second tab | First tab flips to signed-out state on focus |
| 11 | In DevTools set `localStorage.token` to `"garbage"`, reload | Treated as signed out, no crash |
| 12 | Edit the token's `exp` to the past, reload | Session dropped, "Session expired" toast |

### Trading

| # | Action | Expected |
|---|--------|----------|
| 13 | Open `/terminal` | Chart, order book, and watchlist populate; WS status shows connected |
| 14 | Place a market buy | Fill appears; cash and positions update |
| 15 | Place a limit order away from the mid | Rests in open orders; cancel removes it |
| 16 | Open `/markets` | Symbol list renders with live prices |
| 17 | Start a flagship bot from the bot panel | Bot appears in the list; P&L updates |

### Resilience

| # | Action | Expected |
|---|--------|----------|
| 18 | Visit `/no-such-page` | Styled 404 with Go back / Back to home — not a silent redirect |
| 19 | Stop the backend, click around | Toasts report network errors; UI stays usable, no white screen |
| 20 | Hard-refresh on `/portfolio` in the production build | Page loads (SPA rewrite), not a 404 |

### Performance

| # | Action | Expected |
|---|--------|----------|
| 21 | DevTools → Network, throttle to Fast 3G, load `/` | Landing pulls ~308 kB of JS, not the whole app |
| 22 | Navigate to `/terminal` | Chart chunks load on demand |
| 23 | Reload after visiting once | Vendor chunks served from cache |

---

## 3. Datastores — Postgres and Redis (NOT MongoDB)

This project uses **PostgreSQL** (via `pgx/v5`, with 28 SQL migrations under
`internal/db/migrations/sql/`) and **Redis** (event bus, pub/sub + streams).

There is **no MongoDB**. `go.mongodb.org/mongo-driver` appears in `go.mod` only
as an *indirect* transitive dependency — no code imports it. Provisioning a
MongoDB cluster would be wasted effort and nothing would connect to it.

| Need | Render | Alternative |
|------|--------|-------------|
| PostgreSQL 16 | Render PostgreSQL | Neon, Supabase |
| Redis 7 | Render Key Value | Upstash |

Migrations run **automatically at boot**. Note that a migration failure is
logged as a warning and the server continues, so confirm you see
`Database migrations checked` in the logs — not `Warning: migration failed`.

---

## 4. Deploy the backend to Render (do this first)

The frontend is useless without a reachable API, so deploy the backend first and
note its public HTTPS URL.

### 4.1 Create the datastores

1. **New → Postgres.** Name it, pick a region, create. Copy the **Internal
   Database URL** (starts `postgres://`). Internal avoids egress and needs no
   SSL; if you use the *External* URL instead, append `?sslmode=require`.
2. **New → Key Value** (Render's Redis). Same region as the database. Copy its
   **Internal URL** (`redis://…`).

Keep both in the **same region as the web service**, or every query pays a
cross-region round trip.

### 4.2 Create the web service

**New → Web Service** → connect `AYUSHSAINI9876/OpenSoft-2026`, then:

| Setting | Value |
|---------|-------|
| Language / Runtime | **Docker** |
| Root Directory | `Opensoft-26-Backend` |
| Dockerfile Path | `Opensoft-26-Backend/Dockerfile` |
| Health Check Path | `/health` |

The Docker build compiles the C++ matching engine with CMake before building
the Go binary, so expect a slow first build (several minutes).

### 4.3 Environment variables

```bash
APP_ENV=production                 # makes insecure defaults fatal at boot
JWT_SECRET=<openssl rand -base64 48>
DB_URL=<Internal Database URL from step 4.1>
REDIS_URL=<Internal Key Value URL from step 4.1>
CORS_ALLOWED_ORIGINS=https://<your-project>.vercel.app,https://*.vercel.app
```

Two things that catch people out:

- **The variable is `DB_URL`, not `DATABASE_URL`.** Render's dashboard shows the
  connection string under a heading that says "Database URL"; the app reads
  `DB_URL`. Copy the value, not the name.
- **`CORS_ALLOWED_ORIGINS` fails only in production.** Localhost is always
  allowed, so an empty value works perfectly on your machine and blocks every
  browser request once deployed. You will not have the Vercel URL yet — leave
  this for now and set it in step 6.

`PORT` is injected by Render and the server binds to it automatically.

With `APP_ENV=production` the server refuses to start on a missing, placeholder,
or under-32-character `JWT_SECRET`. That is deliberate — a predictable secret
lets anyone forge a token for any account.

### 4.4 Verify

```bash
curl https://<your-service>.onrender.com/health     # expect 200
```

> **Render's free tier is a poor fit for this app.** Free web services sleep
> after ~15 minutes idle, and this backend keeps the order book and simulation
> state **in memory** — a sleep wipes open orders and drops every WebSocket.
> Free Postgres instances also expire after 30 days. Use a paid instance for
> anything you intend to show off.

---

## 5. Deploy the frontend to Vercel

1. **Import the repo** and set **Root Directory** to `Opensoft-26-Frontend`.
   This matters — the repo root has no `package.json`, and the build fails
   immediately without it.
2. Framework preset **Vite** (auto-detected from `vercel.json`).
3. Add the environment variable, for all environments:

   ```
   VITE_API_BASE_URL = https://<your-service>.onrender.com/api/v1
   ```

   It must be **https** (an http API on an https page is blocked as mixed
   content) and must include the `/api/v1` suffix. The WebSocket URL is derived
   automatically (`https` → `wss`).
4. Deploy, then copy the resulting `https://<project>.vercel.app` URL.

`vercel.json` already handles SPA rewrites, immutable asset caching, and
security headers — no dashboard configuration needed.

---

## 6. Close the loop: CORS

Go back to the Render service and set:

```bash
CORS_ALLOWED_ORIGINS=https://<project>.vercel.app,https://*.vercel.app
```

Save — Render redeploys automatically. This step is unavoidably last, because
you cannot know the Vercel URL until step 5 is done.

---

## 7. Post-deploy verification

```bash
curl -I https://<project>.vercel.app/portfolio   # 200, not 404 → rewrites work
curl https://<service>.onrender.com/health       # 200
```

Then open the site with the browser console visible:

- A red `[Oak Capital] VITE_API_BASE_URL is not set…` means the env var is
  missing — set it and **redeploy**. Vite inlines env vars *at build time*, so
  changing the variable without rebuilding does nothing.
- A CORS error means the Vercel domain is missing from `CORS_ALLOWED_ORIGINS`
  (step 6).
- Sign up for an account, then confirm the WebSocket in the Network tab shows
  status **101**. If REST works but the socket fails, the API URL is reachable
  but the host is not forwarding upgrade requests.
- Walk the manual test script in §2.

---

## 8. Known limitations

- **Password reset and account deletion require SMTP.** Without `SMTP_HOST` and
  friends, `/forgot-password` returns "email service not configured".
- **Sessions are 24-hour JWTs with no refresh token.** Users re-authenticate
  daily; the UI now expires the session cleanly instead of failing requests.
- **Tokens live in `localStorage`**, which is readable by any script on the
  page. Moving to an httpOnly cookie would require backend changes to the
  WebSocket's query-param auth.
- **No rate limiting on the auth endpoints** — add one before exposing the
  platform publicly.
- **The WebSocket upgrader accepts any `Origin`.** Connections authenticate with
  an explicit token query parameter rather than ambient cookies, so this is not
  directly exploitable, but tightening it is worthwhile.
