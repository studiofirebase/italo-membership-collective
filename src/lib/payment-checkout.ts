export const DEFAULT_INFINITEPAY_CHECKOUT_URL =
  'https://checkout.infinitepay.io/italosevere/WKqeO7qiL8'

export function getInfinitePayCheckoutUrl(configuredUrl?: string | null): string {
  const checkoutUrl =
    configuredUrl?.trim() ||
    import.meta.env.VITE_INFINITEPAY_CHECKOUT_URL?.trim() ||
    DEFAULT_INFINITEPAY_CHECKOUT_URL
  return normalizeCheckoutUrl(checkoutUrl)
}

export function normalizeCheckoutUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Checkout URLs must use HTTPS and cannot contain credentials.')
  }
  const hostname = url.hostname.toLowerCase()
  const trustedHost =
    hostname === 'infinitepay.io' ||
    hostname.endsWith('.infinitepay.io') ||
    hostname === 'checkout.infinitepay.com.br'
  if (!trustedHost) throw new Error('Untrusted InfinitePay checkout host.')
  return url.href
}
