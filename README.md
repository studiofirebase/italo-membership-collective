# Italo Santos

## Backend: Cloudflare (Workers + D1 + R2)

O backend roda em um único Worker (`worker/`) que também serve o front-end (`dist/`). Dados no D1 (`migrations/`), vídeos/capas no R2, login próprio (PBKDF2 + cookie JWT HttpOnly). O primeiro admin é definido por `ADMIN_EMAILS` em `wrangler.jsonc`. Novos admins são promovidos por um admin no painel (`/admin`, aba Admins) a partir de uma conta já cadastrada — cada pessoa entra com o próprio e-mail e senha. As contas antigas do Supabase não foram migradas: os usuários precisam se cadastrar de novo.

Desenvolvimento local:

```bash
echo 'JWT_SECRET=troque-por-um-segredo-longo' > .dev.vars
npm run db:migrate && npm run cf:dev   # http://localhost:8799 (API; o front fica em 3000 com `npm run dev`)
```

Deploy (o R2 é opcional: sem ele, vídeos usam URL externa; para uploads ative o R2 e descomente `r2_buckets` em wrangler.jsonc) (requer `wrangler login` ou `CLOUDFLARE_API_TOKEN`):

```bash
npx wrangler d1 create italo-membership      # copie o database_id para wrangler.jsonc
npx wrangler r2 bucket create italo-membership-media
npx wrangler secret put JWT_SECRET
npx wrangler secret put MEMBERSHIP_TWITTER_BEARER_TOKEN
npm run db:migrate:remote && npm run cf:deploy
```

Configure o webhook da InfinitePay para `https://<seu-dominio>/api/infinitepay-webhook`. As seções abaixo sobre Supabase/Edge Functions são históricas.

Testes E2E (Playwright, Chromium headless):

```bash
npm run db:migrate   # D1 local (uma vez)
npm run test:e2e      # sobe `wrangler dev` sozinho e roda tests/e2e
# Contra outra base (só smoke + fallback do X; o teste de /membros exige seed local e é pulado):
PLAYWRIGHT_BASE_URL=https://italosantos.com npm run test:e2e
```


создай пустой проект с такими стилями @import url('https://fonts.googleapis.com/css2?family=Bagel+Fat+One&display=swap');

@custom-variant dark (&:is(.dark *));

:root {
  --font-size: 16px;
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #fafafa;
  --card-foreground: #0a0a0a;
  --popover: #ffffff;
  --popover-foreground: #0a0a0a;
  --primary: #0a0a0a;
  --primary-foreground: #ffffff;
  --secondary: #f4f4f5;
  --secondary-foreground: #0a0a0a;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #f4f4f5;
  --accent-foreground: #0a0a0a;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #e4e4e7;
  --input: #f4f4f5;
  --input-background: #ffffff;
  --switch-background: #e4e4e7;
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --ring: #a1a1aa;
  
  /* Simplified accent colors */
  --accent-blue: #2563eb;
  --accent-emerald: #059669;
  --accent-purple: #7c3aed;
  
  --radius: 0.75rem;
}

.dark {
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #1a1a1a;
  --card-foreground: #fafafa;
  --popover: #1a1a1a;
  --popover-foreground: #fafafa;
  --primary: #fafafa;
  --primary-foreground: #0a0a0a;
  --secondary: #1a1a1a;
  --secondary-foreground: #fafafa;
  --muted: #1a1a1a;
  --muted-foreground: #a1a1aa;
  --accent: #1a1a1a;
  --accent-foreground: #fafafa;
  --destructive: #ef4444;
  --destructive-foreground: #fafafa;
  --border: #27272a;
  --input: #1a1a1a;
  --ring: #71717a;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-input-background: var(--input-background);
  --color-switch-background: var(--switch-background);
  --color-ring: var(--ring);
  
  /* Simplified accent colors */
  --color-accent-blue: var(--accent-blue);
  --color-accent-emerald: var(--accent-emerald);
  --color-accent-purple: var(--accent-purple);
  
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground overflow-x-hidden;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    width: 100%;
    max-width: 100vw;
  }
  
  * {
    box-sizing: border-box;
  }
  
  /* Ensure no elements can cause horizontal overflow */
  .container {
    max-width: 100%;
    overflow-x: hidden;
  }
  
  /* Font utility classes */
  .font-bagel {
    font-family: 'Bagel Fat One', cursive;
  }
  
  /* Simplified utility classes */
  .clean-border {
    border: 1px solid var(--border);
  }
  
  .subtle-shadow {
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  }
  
  .elevated-shadow {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  }
  
  .gentle-animation {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Enhanced Glass Effect */
  .glass-effect {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(25px) saturate(1.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  .glass-effect:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-2px);
  }
  
  /* Enhanced glass effect for better visibility */
  .glass-navbar {
    background: rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(30px) saturate(1.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 1px 1px rgba(255, 255, 255, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  }
  
  /* Text shadow utilities for better readability */
  .text-shadow-strong {
    text-shadow: 
      0 2px 4px rgba(0, 0, 0, 0.8),
      0 1px 2px rgba(0, 0, 0, 0.9),
      1px 1px 2px rgba(0, 0, 0, 0.8),
      -1px -1px 2px rgba(0, 0, 0, 0.8);
  }
  
  .text-shadow-medium {
    text-shadow: 
      0 1px 3px rgba(0, 0, 0, 0.7),
      0 1px 1px rgba(0, 0, 0, 0.8),
      1px 1px 1px rgba(0, 0, 0, 0.7),
      -1px -1px 1px rgba(0, 0, 0, 0.7);
  }
  
  /* Video Optimizations */
  .video-container {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }
  
  .video-container video {
    position: absolute;
    top: 50%;
    left: 50%;
    min-width: 100%;
    min-height: 100%;
    width: auto;
    height: auto;
    transform: translateX(-50%) translateY(-50%);
    object-fit: cover;
  }
  
  /* Advanced Animations */
  @keyframes float-gentle {
    0%, 100% { 
      transform: translateY(0px) rotate(0deg); 
    }
    50% { 
      transform: translateY(-10px) rotate(1deg); 
    }
  }
  
  @keyframes pulse-glow {
    0%, 100% { 
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
    }
    50% { 
      box-shadow: 0 0 40px rgba(255, 255, 255, 0.3);
    }
  }
  
  @keyframes drift-left {
    0% { transform: translateX(0px); }
    50% { transform: translateX(-15px); }
    100% { transform: translateX(0px); }
  }
  
  @keyframes drift-right {
    0% { transform: translateX(0px); }
    50% { transform: translateX(15px); }
    100% { transform: translateX(0px); }
  }
  
  @keyframes filmGrain {
    0%, 100% {
      transform: translateX(0) translateY(0);
    }
    25% {
      transform: translateX(1px) translateY(1px);
    }
    50% {
      transform: translateX(-1px) translateY(1px);
    }
    75% {
      transform: translateX(1px) translateY(-1px);
    }
  }
  
  @keyframes projectorLight {
    0%, 100% {
      opacity: 0.05;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 0.15;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }
  
  @keyframes filmScroll {
    from {
      transform: translateX(0px);
    }
    to {
      transform: translateX(-2272px);
    }
  }
  
  @keyframes perforationsScroll {
    from {
      transform: translateX(0px);
    }
    to {
      transform: translateX(-50%);
    }
  }
  
  @keyframes photoSway1 {
    0%, 100% { 
      transform: rotate(2deg) translateY(0px); 
    }
    50% { 
      transform: rotate(-1deg) translateY(-3px); 
    }
  }
  
  @keyframes photoSway2 {
    0%, 100% { 
      transform: rotate(-1deg) translateY(0px); 
    }
    50% { 
      transform: rotate(3deg) translateY(-2px); 
    }
  }
  
  @keyframes photoSway3 {
    0%, 100% { 
      transform: rotate(1deg) translateY(0px); 
    }
    50% { 
      transform: rotate(-2deg) translateY(-4px); 
    }
  }
  
  @keyframes ropeSlackSway {
    0%, 100% { 
      transform: scaleY(1) translateY(0px); 
    }
    50% { 
      transform: scaleY(1.02) translateY(1px); 
    }
  }
  
  .float-gentle {
    animation: float-gentle 6s ease-in-out infinite;
  }
  
  .pulse-glow {
    animation: pulse-glow 3s ease-in-out infinite;
  }
  
  .drift-left {
    animation: drift-left 8s ease-in-out infinite;
  }
  
  .drift-right {
    animation: drift-right 7s ease-in-out infinite;
  }
  
  .photo-sway-1 {
    animation: photoSway1 8s ease-in-out infinite;
  }
  
  .photo-sway-2 {
    animation: photoSway2 9s ease-in-out infinite;
  }
  
  .photo-sway-3 {
    animation: photoSway3 7s ease-in-out infinite;
  }
  
  .rope-sway {
    animation: ropeSlackSway 12s ease-in-out infinite;
  }
  
  .film-scroll-animation {
    animation: filmScroll 28s linear infinite;
  }
  
  .perforations-scroll-animation {
    animation: perforationsScroll 28s linear infinite;
  }
  
  /* Clean scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--background);
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: var(--ring);
  }
}

/**
 * Clean typography system
 */
@layer base {
  :where(:not(:has([class*=" text-"]), :not(:has([class^="text-"])))) {
    h1 {
      font-size: 2.25rem; /* 36px */
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.05em;
    }

    h2 {
      font-size: 1.875rem; /* 30px */
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.04em;
    }

    h3 {
      font-size: 1.5rem; /* 24px */
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.03em;
    }

    h4 {
      font-size: 1.25rem; /* 20px */
      font-weight: 600;
      line-height: 1.4;
      letter-spacing: -0.02em;
    }

    p {
      font-size: 1.125rem; /* 18px */
      font-weight: var(--font-weight-normal);
      line-height: 1.6;
      letter-spacing: 0.01em;
    }

    label {
      font-size: 1rem; /* 16px */
      font-weight: 500;
      line-height: 1.5;
    }

    button {
      font-size: 1rem; /* 16px */
      font-weight: 600;
      line-height: 1.5;
    }

    input {
      font-size: 1rem; /* 16px */
      font-weight: var(--font-weight-normal);
      line-height: 1.5;
    }
  }
}

html {
  font-size: var(--font-size);
  scroll-behavior: smooth;
}

/* Performance optimizations */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Mobile optimizations for video */
@media (max-width: 768px) {
  html, body {
    overflow-x: hidden !important;
    width: 100%;
    max-width: 100vw;
  }
  
  .video-container {
    height: 100dvh; /* Use dynamic viewport height on mobile */
  }
  
  /* Adjust glass effects for mobile */
  .glass-effect {
    backdrop-filter: blur(15px);
  }
  
  .glass-navbar {
    backdrop-filter: blur(20px);
  }
  
  /* Mobile menu optimizations */
  .mobile-menu-panel {
    /* Ensure mobile menu is always on top */
    z-index: 9999;
    max-width: 90vw;
  }
  
  /* Prevent horizontal scroll when mobile menu is open */
  body.mobile-menu-open {
    overflow-x: hidden;
    position: fixed;
    width: 100%;
  }
  
  /* Ensure touch interactions work well on mobile */
  .mobile-menu-link {
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.1);
    touch-action: manipulation;
  }
  
  /* Force all sections to stay within viewport */
  section {
    max-width: 100vw;
    overflow-x: hidden;
  }
  
  /* Ensure containers don't exceed viewport */
  .container {
    max-width: 100vw !important;
    padding-left: 1rem;
    padding-right: 1rem;
  }
  
  /* Prevent scrollbars in Services section */
  #services {
    overflow: visible !important;
  }
  
  #services * {
    overflow: visible !important;
  }
  
  #services::-webkit-scrollbar,
  #services *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  
  /* Prevent scrollbars in Team section */
  #team,
  section[aria-label="Team section"],
  section[aria-label="Team section"] * {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    min-height: 0 !important;
  }
  
  #team::-webkit-scrollbar,
  #team *::-webkit-scrollbar,
  section[aria-label="Team section"]::-webkit-scrollbar,
  section[aria-label="Team section"] *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  
  /* Force Team section to be fully visible */
  section[aria-label="Team section"] {
    overflow: visible !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
  }
  
  /* Fix any absolute positioned elements that might overflow */
  [class*="absolute"] {
    max-width: 100vw;
  }
}

/* Ultra-wide screen optimizations */
@media (min-width: 2560px) {
  .video-container video {
    object-position: center center;
  }
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://italo-membership-collective.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7e5a6d4b-0dc5-4f99-aeaa-2d071c83c4c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

For an isolated local admin-panel preview, run `npm run dev` and open `http://localhost:3000/entrar`. When the ignored `.env.admin-test.local` contains the test credentials, local development accepts `pix@italosantos.com` with password `123456`. This mode is restricted to Vite development on localhost, uses fictional in-memory panel data, and does not read or write Supabase. Never reuse these credentials for a deployed administrator account.

The home-page **Assinar** action opens a floating modal with selectable Google Pay, Apple Pay, and Pix options for signed-in members. Selecting Pix displays a QR code for the generated InfinitePay checkout URL; scanning it opens InfinitePay, where the payer completes the Pix payment. It is a checkout-link QR, not a direct Pix BR Code. New subscriptions created through generated links are activated automatically after backend verification; old/static links still require manual activation. Selecting Apple Pay or Google Pay and continuing opens the official checkout page. InfinitePay controls which methods are available for the account, browser, and device. Visitors sign in or create an account first, then return to the home page and open the payment options after authentication or email confirmation. Mercado Pago is not offered for new payments; historical records remain visible in the admin panel.

### X media feed on the homepage

The homepage hero and media catalog share the `twitter-feed` Edge Function and display photos or videos only from the configured account. Set `TWITTER_USERNAME` (without the `@`) and `TWITTER_BEARER_TOKEN` as Edge Function secrets in the Supabase project. The bearer token is only read by the Edge Function and must not use a `VITE_` prefix.

Deploy the function after setting those secrets:

```sh
supabase functions deploy twitter-feed --project-ref ipgwnkcfarrzglepqufx
```

For local homepage development, `npm run dev` serves `/api/twitter-feed` from the Vite server at `http://localhost:3000`. It reads `TWITTER_USERNAME` from the local environment (default: `severepics`) and parses the official public X timeline server-side, so the browser does not need the X widget or a bearer token. Only media attached to posts authored by that account is displayed; quoted posts and other accounts' media are excluded. X may rate-limit the public timeline, in which case the page reports the error and does not show demo media.

For local Edge Function development instead, run `supabase functions serve twitter-feed --env-file .env`. The public function has JWT verification disabled because the feed contains only public X posts; the X bearer token remains server-side. If the X API connection fails or the account has no recent posts with media, the page shows an error or empty state instead of unrelated or sample media.

### InfinitePay checkout

Membership subscriptions are created through the official InfinitePay Checkout API (`POST https://api.checkout.infinitepay.io/links`) by the authenticated `infinitepay-checkout` Supabase Edge Function. The function reads the first active plan, converts its `price_label` (for example, `R$ 29,90/mês`) to cents, and extracts the InfinitePay handle from that plan's checkout URL or the default `https://checkout.infinitepay.io/italosevere/WKqeO7qiL8`. It sends the signed-in customer's profile name and account email, plus the phone saved in account metadata or collected in the app, so InfinitePay can prefill these checkout fields instead of asking again. No customer details are fabricated; users without saved details provide them in the app before checkout. The plan must have a valid price label and a standard `checkout.infinitepay.io/<handle>/...` URL (or use the default).

Apply the migration and deploy both functions:

```sh
supabase db push --project-ref ipgwnkcfarrzglepqufx
supabase functions deploy infinitepay-checkout --project-ref ipgwnkcfarrzglepqufx
supabase functions deploy infinitepay-webhook --project-ref ipgwnkcfarrzglepqufx
```

The link includes the `infinitepay-webhook` URL. The webhook does not trust the callback alone: it looks up the server-created order binding, asks InfinitePay `POST /payment_check` to verify its handle, order, transaction, and invoice, checks the amount, and then atomically marks that exact pending subscription active. Duplicate notifications are idempotent. The webhook is public (InfinitePay does not document a signature for this callback) and uses the provider's payment-check response as the authoritative confirmation. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions; never put the service-role key in the browser. If provider verification or database processing fails, the webhook responds `400` so InfinitePay can retry the notification.

The Pix option displays a QR code containing the generated checkout URL; scanning it opens the hosted InfinitePay checkout, where Pix can be selected if enabled. It is not a direct Pix BR Code. Payment methods including Pix, Apple Pay, and Google Pay depend on InfinitePay account/browser/device support. After applying the migration and deploying both functions, payments from newly generated links activate subscriptions automatically; older/static links without an order binding remain manual.
