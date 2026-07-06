<div align="center">

# 📟 pocketty

### Your computer terminal, in your pocket.

Drive your computer's **tmux** sessions from your **phone** — a self-hosted PWA
for when you step away from your desk but not from your work.

<sub>`pocket` + `tty`</sub>

[**Quick start**](#setup) · [How it works](#architecture) · [Security](#security-notes)

<!--
  🎥 LAUNCH TODO — drop a demo GIF/screenshot here (the #1 conversion asset):
  phone opens app → taps a shortcut → live terminal → runs `claude --resume`.
  Then replace this comment with:  ![pocketty in action](docs/demo.gif)
-->

</div>

---

## Why pocketty

- 📱 **Phone → real terminal.** A full xterm.js terminal wired over a secure WebSocket to a PTY on your machine.
- 🔁 **Never lose your place.** Sessions live in **tmux**, so they survive disconnects, reboots, and closing the app — resume exactly where you left off.
- ⌨️ **TUIs actually work on mobile.** A touch control bar (arrows, Esc, Tab, Ctrl, Enter) makes `claude --resume`, vim, and menus usable from a phone keyboard.
- ⭐ **One-tap shortcuts.** Save your project folders and launch a fresh session in any of them with a single tap — no typing `cd`.
- 🔒 **Private by default.** Single-user password → JWT, bound to `127.0.0.1`, reachable only over your own [Tailscale](https://tailscale.com/) network. Nothing is exposed to the public internet.
- 🤖 **Made for AI on the CLI.** Built to drive terminal AI agents (`claude`, `codex`, `aider`, …) and your `.zshrc` aliases (`gl`, `cd`, `ls -al`…) on the go.

> **Why it exists:** pocketty was born from a real need — taking my dog **Loky**
> for a walk without losing control of my terminal. 🐕

## Architecture

```
PWA (mobile)  ──HTTPS login──▶  JWT
   │
   └──WSS (token + session)──▶  backend (Fastify) ──node-pty──▶ tmux new -A -s <s> ──▶ zsh
```

- **`packages/server`** — Node + TypeScript. Password→JWT auth, tmux session
  management, and a WebSocket that connects a PTY to the xterm.js terminal.
- **`packages/web`** — PWA with React + Vite + xterm.js. Login, session list,
  and a terminal view with a **touch control bar** (arrows, Esc, Tab, Ctrl,
  Enter) essential for navigating TUIs from the phone keyboard.

## Requirements (on your Mac)

- Node.js ≥ 20
- `tmux` (`brew install tmux`)
- `zsh` (default on macOS) — so your `.zshrc` aliases load
- [Tailscale](https://tailscale.com/) on the Mac **and** on the phone

## Setup

```bash
npm install

# 1. Configure the backend
cd packages/server
cp .env.example .env

# 2. Generate your password hash and paste it into .env (PASSWORD_HASH=...)
npm run hash            # prompts you on the console
#   or:  npm run hash -- 'yourSecurePassword'

# 3. Generate a JWT_SECRET and paste it into .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Edit `packages/server/.env`:
- `PASSWORD_HASH` — the generated hash.
- `JWT_SECRET` — the random secret.
- `SHELL` — `/bin/zsh` on Mac.
- `HOST` — leave it at `127.0.0.1` (you expose it with Tailscale, see below).
- `START_DIR` — *(optional)* default folder for new sessions; also the base that
  relative shortcut paths resolve against.
- `DATA_DIR` — *(optional)* where shortcuts are stored (`favorites.json`);
  defaults to `~/.pocketty`.

## Development (on `localhost`)

```bash
npm run dev        # backend (8723) + web (Vite, 5173) in parallel
```

Open `http://localhost:5173`. Vite's dev server proxies `/api` and the WebSocket
to the backend, so on `localhost` (a secure context) the PWA and the terminal
work fully.

## Local production + remote access with Tailscale

The PWA (service worker, "Add to Home Screen") **requires HTTPS** except on
`localhost`. The simplest and safest way to get HTTPS from your phone without
opening public ports is **`tailscale serve`**, which puts a valid certificate in
front of the backend at a `https://<host>.<tailnet>.ts.net` URL.

```bash
# 1. Build the PWA (the backend serves it as static files on the same origin)
npm run build

# 2. Start the backend (serves API + PWA on port 8723)
npm start

# 3. Expose over HTTPS within your tailnet (requires HTTPS enabled in the
#    Tailscale admin console: Settings → Keys → HTTPS Certificates)
tailscale serve --bg 8723
tailscale serve status     # shows the URL https://<host>.<tailnet>.ts.net
```

On the phone (with Tailscale active and logged into your tailnet):
1. Open the `https://<host>.<tailnet>.ts.net` URL.
2. Log in with your password.
3. "Add to Home Screen" to install the PWA.

> Only your own devices on the tailnet can reach the backend; nothing is exposed
> to the public internet. The password→JWT is the second layer.

## Usage

1. **Log in** with your password.
2. **Session list**: create a new one or resume an existing one (it stays alive
   even if you close the app).
3. **Shortcuts** (bottom bar): save the folders you use often and launch a fresh
   session in one with a single tap — no `cd` needed. Paths can be absolute or
   relative to `START_DIR`. Manage them with the `＋` (add) and `✎` (edit/delete)
   buttons.
4. In the **terminal**: type normal commands. For TUIs like `claude --resume`,
   use the bottom **control bar** for arrows/Enter/Esc; the **Ctrl** button
   turns the next key into Ctrl+_ (e.g. Ctrl+C).

## Security notes

- This grants access to a shell on your machine: keep `HOST=127.0.0.1` +
  Tailscale, a strong `JWT_SECRET`, and a robust password.
- The backend never stores the password in plaintext (only the bcrypt hash).
- Closing the terminal on the phone *detaches* tmux; it does **not** kill the
  session. To end it, use the ✕ button in the session list.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Backend + PWA in development mode |
| `npm run build` | Build the PWA and the backend |
| `npm start` | Start the backend (serves API + PWA) |
| `npm run hash` | Generate the bcrypt hash of a password |
