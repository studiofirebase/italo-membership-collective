import { api } from '@/integrations/api/client'
import { normalizeCheckoutUrl } from '@/lib/payment-checkout'

export async function startSubscriptionCheckout(details?: { name: string; phone: string }): Promise<string> {
  const { data, error } = await api.functions.invoke<{ checkout_url: string }>('infinitepay-checkout', {
    body: details ? { customer_name: details.name, phone_number: details.phone } : {},
  })
  if (error) throw error
  if (!data?.checkout_url) throw new Error('InfinitePay não retornou o endereço do pagamento.')
  return normalizeCheckoutUrl(data.checkout_url)
}
