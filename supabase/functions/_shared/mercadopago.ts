import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

export function database() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Cloud configuration unavailable')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function mercadoPago(path: string, options: RequestInit = {}) {
  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!token) throw new Error('Mercado Pago não configurado')
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    // Provider bodies can contain buyer information; do not expose or log them.
    console.error('Mercado Pago request failed', response.status, path.split('/')[1])
    throw new Error(`Mercado Pago indisponível (${response.status})`)
  }
  return response.json()
}

export async function signedInUser(req: Request) {
  const header = req.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!header?.startsWith('Bearer ') || !url || !key) return null
  const client = createClient(url, key)
  const { data, error } = await client.auth.getUser(header.slice(7))
  return error ? null : data.user
}