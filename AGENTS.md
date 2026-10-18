# AGENTS.md

## Architecture decisions
- Routing uses react-router-dom (react-router-dom v7). Routes: `/` landing, `/entrar` auth page, `/membros` member area, `/admin` admin panel.
- Auth state lives in `src/context/AuthContext.tsx` (session, profile, isAdmin). Never read auth state from localStorage directly.
- Admin role: stored in `public.user_roles`, checked via `public.has_role()`; the first registered user is auto-promoted to admin by the `on_first_user_admin` trigger.
- Payment confirmation is manual: the admin activates subscriptions/purchases in the admin panel. Payment "buttons" open pasted checkout URLs (InfinitePay enrollment links, Mercado Pago subscription links) — no provider webhooks; revisit if automated billing is requested.
- Social login uses `lovable.auth.signInWithOAuth` from `@/integrations/lovable` (never `supabase.auth.signInWithOAuth` directly).
