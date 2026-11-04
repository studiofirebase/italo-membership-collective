'use client'

import { Play, ExternalLink } from 'lucide-react'
import { Button } from './ui/button'

export function Portfolio() {
  return (
    <section id="portfolio" className="relative py-32 bg-background">
      <div className="container mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-accent-emerald rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-muted-foreground">
              Trabalho em destaque
            </span>
            <div className="w-3 h-3 bg-accent-blue rounded-full animate-pulse" />
          </div>

          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight mb-8">
            <span className="block mb-2">Produções criativas</span>
          </h2>

          <p className="text-2xl lg:text-3xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Nosso último comercial para a Hampton — explorando a jornada solitária de fundadores de startups e o poder da comunidade.
          </p>
        </div>

        {/* Featured Video */}
        <div className="max-w-6xl mx-auto">
          <div className="relative bg-card clean-border rounded-3xl overflow-hidden elevated-shadow">
            {/* Video Embed */}
            <div className="relative">
              <div className="aspect-video">
                <iframe
                  src="https://www.youtube.com/embed/fIbDWDh6aYw?rel=0&showinfo=0&modestbranding=1"
                  title="Comercial da Hampton - A jornada solitária"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full rounded-t-3xl"
                />
              </div>
              
              {/* Floating Status Badge */}
              <div className="absolute top-6 right-6">
                <span className="glass-effect rounded-xl px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
                  Último projeto
                </span>
              </div>
            </div>

            {/* Project Details */}
            <div className="p-8 lg:p-12">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <span className="bg-accent-purple/10 text-accent-purple px-3 py-1 rounded-full text-sm font-medium">
                    Comercial
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Cliente: Hampton
                  </span>
                </div>

                <h3 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                  A jornada solitária
                </h3>

                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  Um comercial poderoso que explora o isolamento enfrentado por fundadores de startups e como entrar na comunidade da Hampton pode transformar essa jornada. A peça captura o peso emocional do empreendedorismo e o alívio de encontrar sua tribo.
                </p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Setor</span>
                    <span className="font-medium">Plataforma de comunidade</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Estilo</span>
                    <span className="font-medium">Drama narrativo</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Tom</span>
                    <span className="font-medium">Jornada emocional</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Formato</span>
                    <span className="font-medium">Comercial digital</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}