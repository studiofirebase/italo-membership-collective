// Constantes compartilhadas entre global-setup e specs.
// O usuário/senha abaixo só existe no D1 LOCAL (seed via global-setup) —
// nunca aponte a suíte com seed para produção.

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8799';

export const IS_LOCAL = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#]|$)/i.test(BASE_URL);

export const E2E_EMAIL = 'e2e-fallback@italosantos.com';
export const E2E_PASSWORD = 'e2e-fallback-123456';
export const E2E_VIDEO_TITLE = 'Vídeo E2E link quebrado';
export const E2E_EMBED_TITLE = 'Vídeo E2E embed permanente';
export const E2E_EMBED_URL = 'https://player.onnowplay.com/embed/e2e-permanente';
export const E2E_ADMIN_VIDEO_TITLE = 'Vídeo E2E admin links';
export const E2E_ADMIN_PASSWORD = 'e2e-admin-123456';
// Credenciais do admin E2E (usuário promovido via ADMIN_EMAILS do wrangler.jsonc).
// Gravado pelo global-setup; nunca existe em produção.
export const E2E_ADMIN_CREDS_FILE = 'tests/e2e/.admin.json';

// Links 127.0.0.1:9 são propositalmente inalcançáveis: simulam link quebrado
// sem depender de rede externa (a spec ainda aborta a rota por determinismo).
export const E2E_BROKEN_THUMB = 'https://127.0.0.1:9/e2e-thumb.jpg';
export const E2E_BROKEN_VIDEO = 'https://127.0.0.1:9/e2e-video-1.m3u8';

// Resposta controlada de /api/twitter-feed: 1 vídeo + 1 foto do X.
export function twitterFeedFixture() {
  const createdAt = '2026-10-20T12:00:00.000Z';
  return {
    username: 'severepics',
    posts: [
      {
        id: '1234567890123456789',
        text: 'Vídeo de teste do X',
        created_at: createdAt,
        url: 'https://x.com/severepics/status/1234567890123456789',
        media: [
          {
            type: 'video',
            url: 'https://video.twimg.com/ext_tw_video/abc/pu/vid/1280x720/x.mp4',
            preview_url: 'https://pbs.twimg.com/media/abc.jpg',
            alt_text: 'prévia do vídeo',
          },
        ],
      },
      {
        id: '1234567890123456790',
        text: 'Foto de teste do X',
        created_at: createdAt,
        url: 'https://x.com/severepics/status/1234567890123456790',
        media: [
          {
            type: 'photo',
            url: 'https://pbs.twimg.com/media/def.jpg',
          },
        ],
      },
    ],
  };
}
