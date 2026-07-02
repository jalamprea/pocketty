# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-user tool to drive your computer's terminal/tmux sessions **from your phone** via a PWA — built for daily use with Claude Code (`claude --resume`) and your `.zshrc` aliases. See `README.md` for the full setup/usage walkthrough.

## Commands

Run from the repo root (npm workspaces):

```bash
npm install           # installs both workspaces
npm run dev           # backend (:8723) + Vite web (:5173) in parallel
npm run dev:server    # backend only (tsx watch)
npm run dev:web       # web only (Vite)
npm run build         # builds web then server (order matters — see below)
npm start             # runs the built backend; serves API + PWA on :8723
npm run hash          # bcrypt-hash a password for PASSWORD_HASH
```

There is **no test suite and no linter** configured. `build` is the only correctness gate (`tsc`).

Develop against `http://localhost:5173` (Vite proxies `/api` and the `/api/terminal` WS to the backend). `localhost` is a secure context, so the PWA and terminal work fully without HTTPS; for phone access the README uses `tailscale serve`.

## Architecture

```
PWA (mobile) ──HTTPS login──▶ JWT
   └──WSS (token + session in query)──▶ Fastify ──node-pty──▶ tmux new -A -s <s> ──▶ zsh
```

Two packages, both ESM (`"type": "module"`), TypeScript, sharing `tsconfig.base.json`:

- **`packages/server`** — Fastify. Auth, tmux session management, and a WebSocket that wires a PTY to the client terminal.
- **`packages/web`** — React + Vite + xterm.js PWA. Login → session list → terminal view with a touch control bar.

### Server (`packages/server/src`)

- `config.ts` — central env config; `JWT_SECRET` and `PASSWORD_HASH` are **required** (throws on startup if missing). Copy `.env.example` → `.env`.
- `auth.ts` — single-user model: one bcrypt password hash → a JWT (`sub: 'pocketty-user'`). No user accounts.
- `tmux.ts` — shells out to `tmux` via `execFile` (arg arrays, never a shell string). `listSessions` treats "no server/sessions" as an empty list. Session names are validated against `NAME_RE` (`isValidSessionName`) on **every** route to prevent injection — keep this guard when adding session endpoints.
- `terminal.ts` — `attachTerminal` spawns `tmux new-session -A -s <name>` (attach-or-create). **tmux is the persistence layer**: closing the WebSocket calls `term.kill()` which only _detaches_ the tmux client; the session stays alive for resume. Killing a session is explicit (the DELETE route).
- `index.ts` — routes + WS handler. In production, if `web/dist` exists it's served statically with an SPA fallback (non-`/api` routes → `index.html`).

### Web (`packages/web/src`)

- `App.tsx` — view state machine (`login` | `sessions` | `terminal`), no router.
- `api.ts` — fetch wrapper that attaches `Authorization: Bearer`; a 401 clears the token and throws `AuthError`, which bubbles up to log the user out. Token lives in `localStorage`.
- `components/TerminalView.tsx` — owns the xterm.js instance and WebSocket. Sends `{type:'input'|'resize'}` JSON frames; a `ResizeObserver` + `FitAddon` keep the PTY size in sync. The **Ctrl emulation** (also in `ControlBar`): tapping Ctrl arms `ctrlRef`, and the next single keystroke is converted to its control char via `& 0x1f` (e.g. Ctrl+C).
- `components/ControlBar.tsx` — touch buttons (arrows, Esc, Tab, Ctrl, Enter) for navigating TUIs from a phone keyboard.

## Conventions / gotchas

- **WS auth is via query params** (`?token=…&session=…`), not headers — browsers can't set headers on `WebSocket`. The handler verifies the token and validates the session name before attaching.
- Server imports use **`.js`** extensions (NodeNext resolution); web imports use **`.ts`/`.tsx`**. Match the package you're editing.
- `npm run build` builds **web first, then server** because the server's static handler serves `web/dist`.
- User-facing strings and code comments in this repo are in **English**; keep that style when editing existing files.
