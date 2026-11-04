import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const CONTACT = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '') || 'italosantosrj'
const GREETING = 'Olá! Vim pelo site e gostaria de saber mais sobre a assinatura.'

function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className} fill="currentColor">
      <path d="M16.003 3C8.83 3 3 8.826 3 15.99c0 2.29.6 4.52 1.738 6.49L3 29l6.72-1.716a13 13 0 0 0 6.28 1.6h.005C23.17 28.884 29 23.058 29 15.894 29 12.45 27.66 9.21 25.22 6.78A12.9 12.9 0 0 0 16.003 3Zm0 23.7h-.004a10.8 10.8 0 0 1-5.5-1.5l-.395-.234-3.99 1.02 1.066-3.89-.257-.4a10.7 10.7 0 0 1-1.65-5.7c0-5.95 4.85-10.79 10.82-10.79 2.89 0 5.6 1.12 7.64 3.16a10.7 10.7 0 0 1 3.16 7.64c0 5.95-4.85 10.79-10.89 10.79Zm5.92-8.08c-.325-.162-1.92-.947-2.217-1.055-.297-.108-.513-.162-.73.163-.216.324-.838 1.054-1.027 1.27-.19.217-.378.244-.703.082-.325-.163-1.37-.505-2.61-1.61-.964-.86-1.615-1.922-1.805-2.246-.19-.325-.02-.5.142-.662.146-.145.325-.379.487-.568.163-.19.217-.325.325-.54.108-.217.054-.406-.027-.568-.081-.163-.73-1.76-1-2.41-.264-.633-.532-.547-.73-.557l-.62-.011c-.217 0-.568.081-.865.406-.297.324-1.135 1.108-1.135 2.703 0 1.595 1.162 3.136 1.324 3.352.163.217 2.286 3.49 5.54 4.894.774.334 1.378.533 1.85.683.777.247 1.484.212 2.043.129.623-.093 1.92-.785 2.19-1.543.27-.757.27-1.406.19-1.541-.08-.136-.297-.217-.622-.38Z" />
    </svg>
  )
}

function clock() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function WhatsAppBubble() {
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [time] = useState(clock)

  useEffect(() => {
    if (!open) return
    setTyping(true)
    const id = window.setTimeout(() => setTyping(false), 1400)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const href = `https://wa.me/${CONTACT}?text=${encodeURIComponent(GREETING)}`

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Conversar no WhatsApp"
          className="w-[calc(100vw-2.5rem)] max-w-[340px] origin-bottom-right animate-in fade-in zoom-in-95 overflow-hidden rounded-2xl bg-[#0b141a] shadow-[0_20px_60px_rgba(0,0,0,.55)] ring-1 ring-white/10"
        >
          <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dfe5e7] font-bold text-[#075e54]">IS</div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#25d366] ring-2 ring-[#075e54]" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-semibold">Italo Santos</p>
              <p className="text-xs text-white/80">online agora</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-full p-1.5 text-white/90 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="min-h-[130px] space-y-2 px-4 py-4"
            style={{
              backgroundColor: '#0b141a',
              backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          >
            {typing ? (
              <div className="inline-flex items-center gap-1 rounded-lg rounded-tl-none bg-[#202c33] px-4 py-3" aria-label="Digitando">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            ) : (
              <div className="relative max-w-[85%] rounded-lg rounded-tl-none bg-[#202c33] px-3 pb-5 pt-2 text-sm text-[#e9edef] shadow">
                <p className="font-semibold text-[#53bdeb]">Italo Santos</p>
                <p className="mt-0.5 leading-snug">Olá! 👋 Como posso ajudar? Tire suas dúvidas sobre a assinatura.</p>
                <span className="absolute bottom-1 right-2 text-[10px] text-[#8696a0]">{time}</span>
              </div>
            )}
          </div>

          <div className="bg-[#111b21] p-3">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#25d366] px-5 py-2.5 font-bold text-[#06220f] transition hover:bg-[#2fe674] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <WhatsAppLogo className="h-5 w-5" />
              Iniciar conversa
            </a>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar WhatsApp' : 'Abrir WhatsApp'}
        aria-expanded={open}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_8px_24px_rgba(37,211,102,.45)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        {!open && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-[#25d366] opacity-30" />}
        <WhatsAppLogo className="relative h-8 w-8" />
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff3b30] text-[11px] font-bold ring-2 ring-[#0a0a0b]">1</span>
        )}
      </button>
    </div>
  )
}
