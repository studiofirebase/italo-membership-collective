import { api } from '@/integrations/api/client'

export const MEMBERSHIP_MEDIA_BUCKET = 'membership-media'

export function isMembershipMediaPath(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith('videos/'))
}

export async function resolveMembershipMediaUrl(value: string | null): Promise<string | null> {
  if (!value || !isMembershipMediaPath(value)) return value

  try {
    const { data, error } = await api.storage
      .from(MEMBERSHIP_MEDIA_BUCKET)
      .createSignedUrl(value, 60 * 60)

    // Fallback: se a assinatura falhar, mantém o valor original em vez de
    // estourar e derrubar a lista inteira de vídeos (Promise.all no Members).
    if (error || !data?.signedUrl) {
      console.warn('Fallback de mídia: mantendo caminho original.', value, error?.message ?? '')
      return value
    }
    return data.signedUrl
  } catch (error) {
    console.warn('Fallback de mídia: mantendo caminho original.', value, error instanceof Error ? error.message : '')
    return value
  }
}
