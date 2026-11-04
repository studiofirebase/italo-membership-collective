# AGENTS.md

## Architecture decisions
- Routing uses react-router-dom (react-router-dom v7). Routes: `/` landing, `/entrar` auth page, `/membros` member area, `/admin` admin panel.
- Auth state lives in `src/context/AuthContext.tsx` (session, profile, isAdmin). Never read auth state from localStorage directly.
- Backend is Cloudflare (Worker in `worker/`, D1 in `migrations/`, R2 for media); the frontend talks to it through `src/integrations/api/client.ts`. Admin role: stored in the D1 `user_roles` table; emails listed in `ADMIN_EMAILS` (wrangler.jsonc) are promoted to admin. Additional admins are promoted by email in the admin panel (Admins tab, `POST /api/admin-promote`, admin-only, existing accounts only).
- Payment confirmation is manual: the admin activates subscriptions/purchases in the admin panel. Payment "buttons" open pasted checkout URLs (InfinitePay enrollment links, Mercado Pago subscription links) — no provider webhooks; revisit if automated billing is requested.
- Login is e-mail + password only (no social login).
