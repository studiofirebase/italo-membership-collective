import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AnimationShowcase from "@/components/AnimationShowcase";
import GlassCard from "@/components/GlassCard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/20 via-accent-purple/10 to-accent-emerald/20"></div>

        <div className="relative z-10 text-center space-y-8 max-w-4xl mx-auto px-4">
          <h1 className="font-bagel text-6xl md:text-8xl text-shadow-strong">
            BAGEL FAT
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Demonstração de um sistema de design elegante com animações e efeitos
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              className="glass-effect hover:glass-effect gentle-animation px-8 py-3"
              style={{ background: 'var(--accent-blue)', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Começar
            </Button>
            <Button
              variant="outline"
              className="glass-effect hover:glass-effect gentle-animation px-8 py-3"
            >
              Saiba mais
            </Button>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 left-20 w-4 h-4 bg-accent-blue rounded-full float-gentle opacity-60"></div>
        <div className="absolute top-40 right-32 w-6 h-6 bg-accent-emerald rounded-full drift-left opacity-40"></div>
        <div className="absolute bottom-32 left-1/4 w-5 h-5 bg-accent-purple rounded-full drift-right opacity-50"></div>
      </section>

      {/* Animation Showcase */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 font-bagel">
            Animações e efeitos
          </h2>
          <AnimationShowcase />
        </div>
      </section>

      {/* Glass Effects Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-accent-blue/5 via-accent-purple/5 to-accent-emerald/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 font-bagel">
            Efeitos em vidro
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard
              title="Vidro"
              description="Efeito principal em vidro com desfoque e transparência"
              className="glass-effect"
            />
            <GlassCard
              title="Navegação"
              description="Efeito aprimorado para elementos de navegação"
              className="glass-navbar"
            />
            <GlassCard
              title="Brilho"
              description="Efeito com brilho pulsante"
              className="glass-effect pulse-glow"
            />
          </div>
        </div>
      </section>

      {/* Typography Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-bold font-bagel">Tipografia</h2>

          <div className="space-y-6">
            <h1 className="font-bagel text-shadow-medium">Título H1 com Bagel Fat</h1>
            <h2>Título H2 com fonte do sistema</h2>
            <h3>Título H3 com tipografia aprimorada</h3>
            <p>
              Texto comum com espaçamento e legibilidade otimizados.
              O sistema suporta tamanhos responsivos e proporções corretas.
            </p>
          </div>
        </div>
      </section>

      {/* Color Palette */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 font-bagel">
            Paleta de cores
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-8 text-center subtle-shadow gentle-animation hover:elevated-shadow">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4"
                style={{ backgroundColor: 'var(--accent-blue)' }}
              ></div>
              <h3 className="text-xl font-semibold mb-2">Azul destaque</h3>
              <p className="text-muted-foreground">#2563eb</p>
            </Card>

            <Card className="p-8 text-center subtle-shadow gentle-animation hover:elevated-shadow">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4"
                style={{ backgroundColor: 'var(--accent-emerald)' }}
              ></div>
              <h3 className="text-xl font-semibold mb-2">Esmeralda destaque</h3>
              <p className="text-muted-foreground">#059669</p>
            </Card>

            <Card className="p-8 text-center subtle-shadow gentle-animation hover:elevated-shadow">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4"
                style={{ backgroundColor: 'var(--accent-purple)' }}
              ></div>
              <h3 className="text-xl font-semibold mb-2">Roxo destaque</h3>
              <p className="text-muted-foreground">#7c3aed</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;