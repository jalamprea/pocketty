# tui-app-server

Maneja las sesiones de terminal de tu laptop **desde el móvil**, vía una PWA.
Pensado para uso diario con **Claude Code**: crear/retomar sesiones del CLI
(`claude --resume`), correr comandos y alias de tu `.zshrc` (`gl`,
`gdevtostage`, `cd`, `ls -al`…) y luego saltar a la app de Claude Code móvil.

Las sesiones corren dentro de **tmux**, así que sobreviven a desconexiones del
móvil y a reinicios del backend: puedes retomar exactamente donde estabas,
incluyendo TUIs interactivas (menús, flechas, ANSI) como `claude --resume`.

## Arquitectura

```
PWA (móvil)  ──HTTPS login──▶  JWT
   │
   └──WSS (token + sesión)──▶  backend (Fastify) ──node-pty──▶ tmux new -A -s <s> ──▶ zsh
```

- **`packages/server`** — Node + TypeScript. Auth con password→JWT, gestión de
  sesiones tmux y un WebSocket que conecta un PTY al terminal de xterm.js.
- **`packages/web`** — PWA con React + Vite + xterm.js. Login, lista de sesiones
  y vista de terminal con una **botonera táctil** (flechas, Esc, Tab, Ctrl,
  Enter) imprescindible para navegar TUIs desde el teclado del celular.

## Requisitos (en tu Mac)

- Node.js ≥ 20
- `tmux` (`brew install tmux`)
- `zsh` (default en macOS) — así se cargan tus alias de `.zshrc`
- [Tailscale](https://tailscale.com/) en la Mac **y** en el móvil

## Setup

```bash
npm install

# 1. Configurar el backend
cd packages/server
cp .env.example .env

# 2. Generar el hash de tu password y pegarlo en .env (PASSWORD_HASH=...)
npm run hash            # te lo pide por consola
#   o:  npm run hash -- 'tuPasswordSeguro'

# 3. Generar un JWT_SECRET y pegarlo en .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Edita `packages/server/.env`:
- `PASSWORD_HASH` — el hash generado.
- `JWT_SECRET` — el secreto aleatorio.
- `SHELL` — `/bin/zsh` en Mac.
- `HOST` — déjalo en `127.0.0.1` (lo expones con Tailscale, ver abajo).

## Desarrollo (en `localhost`)

```bash
npm run dev        # backend (8723) + web (Vite, 5173) en paralelo
```

Abre `http://localhost:5173`. El dev server de Vite hace proxy de `/api` y del
WebSocket al backend, así que en `localhost` (que es contexto seguro) la PWA y
el terminal funcionan completos.

## Producción local + acceso remoto con Tailscale

La PWA (service worker, "Agregar a inicio") **requiere HTTPS** salvo en
`localhost`. La forma más simple y segura de tener HTTPS desde el móvil sin
abrir puertos públicos es **`tailscale serve`**, que pone un certificado válido
delante del backend en una URL `https://<host>.<tailnet>.ts.net`.

```bash
# 1. Build de la PWA (el backend la sirve como estáticos en el mismo origen)
npm run build

# 2. Arrancar el backend (sirve API + PWA en el puerto 8723)
npm start

# 3. Exponer por HTTPS dentro de tu tailnet (requiere HTTPS habilitado en la
#    admin console de Tailscale: Settings → Keys → HTTPS Certificates)
tailscale serve --bg 8723
tailscale serve status     # muestra la URL https://<host>.<tailnet>.ts.net
```

En el móvil (con Tailscale activo y logueado en tu tailnet):
1. Abre la URL `https://<host>.<tailnet>.ts.net`.
2. Loguéate con tu password.
3. "Agregar a pantalla de inicio" para instalar la PWA.

> Solo tus propios dispositivos en el tailnet pueden alcanzar el backend; no se
> expone nada al internet público. El password→JWT es la segunda capa.

## Uso

1. **Login** con tu password.
2. **Lista de sesiones**: crea una nueva o retoma una existente (sigue viva
   aunque cierres la app).
3. En el **terminal**: escribe comandos normales. Para TUIs como
   `claude --resume`, usa la **botonera** inferior para flechas/Enter/Esc; el
   botón **Ctrl** convierte la siguiente tecla en Ctrl+_ (ej. Ctrl+C).

## Notas de seguridad

- Esto da acceso a una shell de tu máquina: mantén `HOST=127.0.0.1` + Tailscale,
  un `JWT_SECRET` fuerte y un password robusto.
- El backend nunca guarda el password en claro (solo el hash bcrypt).
- Cerrar el terminal en el móvil hace *detach* de tmux; **no** mata la sesión.
  Para terminarla, usa el botón ✕ en la lista de sesiones.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend + PWA en modo desarrollo |
| `npm run build` | Build de la PWA y del backend |
| `npm start` | Arranca el backend (sirve API + PWA) |
| `npm run hash` | Genera el hash bcrypt de un password |
