import { Card } from "@/components/ui/card";

const AnimationShowcase = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {/* Float Gentle */}
      <Card className="p-6 subtle-shadow">
        <div className="float-gentle">
          <div 
            className="w-16 h-16 rounded-lg mx-auto mb-4"
            style={{ backgroundColor: 'var(--accent-blue)' }}
          ></div>
        </div>
        <h3 className="text-xl font-semibold text-center mb-2">Flutuação suave</h3>
        <p className="text-muted-foreground text-center">Oscilação suave para cima e para baixo</p>
      </Card>

      {/* Drift Left */}
      <Card className="p-6 subtle-shadow">
        <div className="drift-left">
          <div 
            className="w-16 h-16 rounded-lg mx-auto mb-4"
            style={{ backgroundColor: 'var(--accent-emerald)' }}
          ></div>
        </div>
        <h3 className="text-xl font-semibold text-center mb-2">Deslocamento à esquerda</h3>
        <p className="text-muted-foreground text-center">Movimento lento para a esquerda e direita</p>
      </Card>

      {/* Drift Right */}
      <Card className="p-6 subtle-shadow">
        <div className="drift-right">
          <div 
            className="w-16 h-16 rounded-lg mx-auto mb-4"
            style={{ backgroundColor: 'var(--accent-purple)' }}
          ></div>
        </div>
        <h3 className="text-xl font-semibold text-center mb-2">Deslocamento à direita</h3>
        <p className="text-muted-foreground text-center">Oscilação suave da direita para a esquerda</p>
      </Card>

      {/* Photo Sway 1 */}
      <Card className="p-6 subtle-shadow">
        <div className="photo-sway-1">
          <div 
            className="w-16 h-20 rounded-lg mx-auto mb-4"
            style={{ backgroundColor: 'var(--accent-blue)' }}
          ></div>
        </div>
        <h3 className="text-xl font-semibold text-center mb-2">Oscilação da foto</h3>
        <p className="text-muted-foreground text-center">Imitação de movimento suave da foto</p>
      </Card>

      {/* Pulse Glow */}
      <Card className="p-6 subtle-shadow">
        <div className="pulse-glow">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-4"
            style={{ backgroundColor: 'var(--accent-emerald)' }}
          ></div>
        </div>
        <h3 className="text-xl font-semibold text-center mb-2">Brilho pulsante</h3>
        <p className="text-muted-foreground text-center">Brilho pulsante</p>
      </Card>

      {/* Gentle Animation */}
      <Card className="p-6 subtle-shadow gentle-animation hover:elevated-shadow">
        <div 
          className="w-16 h-16 rounded-lg mx-auto mb-4"
          style={{ backgroundColor: 'var(--accent-purple)' }}
        ></div>
        <h3 className="text-xl font-semibold text-center mb-2">Hover suave</h3>
        <p className="text-muted-foreground text-center">Transição suave ao passar o mouse</p>
      </Card>
    </div>
  );
};

export default AnimationShowcase;