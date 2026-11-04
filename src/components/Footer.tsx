import { Link } from 'react-router-dom'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'

const linkClass =
  'text-[#c8c8cc] underline-offset-4 transition hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-[#0a0a0b] text-[#f7f7f5]">
      <div className="mx-auto w-full max-w-[1220px] px-6 py-12 sm:px-8 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="font-bagel text-3xl tracking-wider text-[#f7f7f5]">Italo Santos</div>
            <p className="mt-4 max-w-sm leading-relaxed text-[#a8a8ad]">
              Fotos e vídeos exclusivos, direto do X. Assine e acesse a área de membros.
            </p>
            <a
              href="https://x.com/severepics"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Italo Santos no X (abre em nova aba)"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-[#f7f7f5] transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @severepics
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>

          <nav aria-label="Navegação do rodapé">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[.15em] text-[#77777d]">Navegação</h2>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className={linkClass}>Início</Link></li>
              <li><Link to="/membros" className={linkClass}>Área de membros</Link></li>
              <li><Link to="/entrar" className={linkClass}>Entrar</Link></li>
              <li><Link to="/entrar?mode=signup" className={linkClass}>Criar conta</Link></li>
            </ul>
          </nav>

          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[.15em] text-[#77777d]">Pagamento</h2>
            <p className="inline-flex items-start gap-2 text-sm leading-relaxed text-[#c8c8cc]">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Pagamento seguro pela InfinitePay. Acesso liberado por 30 dias após a confirmação.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs leading-relaxed text-[#77777d]">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span>© 2019 Italo Santos. Todos os direitos reservados.</span>
            <span>CNPJ 44.970.751/0001-06</span>
          </div>
          <p className="max-w-4xl">
            Este site inclui conteúdo protegido por direitos autorais. É proibida a reprodução total ou parcial sem autorização prévia do proprietário do site.
          </p>
        </div>
      </div>
    </footer>
  )
}
