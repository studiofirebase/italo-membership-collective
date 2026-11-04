import { handleAuth } from './auth'
import { handleBulkVideoUrls, handleCheckLinks } from './admin-media'
import { handlePromoteAdmin } from './admin-users'
import { handleDb, handleRpc } from './db'
import { handleCheckout, handleWebhook } from './infinitepay'
import { handleMedia } from './media'
import { handleTwitterFeed } from './twitter'
import { errorResponse, HttpError, type Env } from './lib'

function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  return !origin || origin === new URL(request.url).origin
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    try {
      const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      // O webhook é chamado pela InfinitePay (sem Origin do site) e se autentica via payment_check.
      if (unsafe && path !== '/api/infinitepay-webhook' && !sameOrigin(request)) {
        throw new HttpError(403, 'forbidden', 'Origem não permitida.')
      }

      if (path.startsWith('/api/auth/')) return await handleAuth(request, env, path.slice('/api/auth'.length))
      if (path === '/api/db' && request.method === 'POST') return await handleDb(request, env)
      if (path.startsWith('/api/rpc/') && request.method === 'POST') {
        return await handleRpc(request, env, path.slice('/api/rpc/'.length))
      }
      if (path.startsWith('/api/media/')) return await handleMedia(request, env, path.slice('/api/media'.length))
      if (path === '/api/twitter-feed') return await handleTwitterFeed(request, env)
      if (path === '/api/infinitepay-checkout') return await handleCheckout(request, env)
      if (path === '/api/infinitepay-webhook') return await handleWebhook(request, env)
      if (path === '/api/admin-check-links') return await handleCheckLinks(request, env)
      if (path === '/api/admin-bulk-video-urls') return await handleBulkVideoUrls(request, env)
      if (path === '/api/admin-promote') return await handlePromoteAdmin(request, env)
      if (path.startsWith('/api/')) throw new HttpError(404, 'not_found', 'Rota não encontrada.')

      return await env.ASSETS.fetch(request)
    } catch (error) {
      return errorResponse(error)
    }
  },
} satisfies ExportedHandler<Env>
