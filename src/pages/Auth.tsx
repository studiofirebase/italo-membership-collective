import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable/index'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name || undefined },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Conta criada! Enviamos um e-mail de confirmação — clique no link para ativar sua conta.')
          return
        }
        navigate('/membros')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/membros')
      }
    } catch (err: any) {
      setError(
        mode === 'signin'
          ? 'E-mail ou senha incorretos. Tente novamente.'
          : err?.message?.includes('already registered')
            ? 'Este e-mail já está cadastrado. Faça login.'
            : 'Não foi possível criar a conta. Verifique os dados e tente novamente.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'lovable') => {
    setError(null)
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    })
    if (result.error) setError('Não foi possível iniciar o login. Tente novamente.')
    if (result.redirected) return
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-red-600/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <Link
          to="/"
          className="font-bagel text-2xl tracking-wider text-white block text-center mb-8 hover:opacity-80"
        >
          MOJJU
        </Link>

        <div className="glass-effect rounded-2xl p-8 bg-white/5 border border-white/10 backdrop-blur-xl">
          <h1 className="text-2xl font-bold text-center mb-1">
            {mode === 'signin' ? 'Bem-vindo de volta' : 'Criar sua conta'}
          </h1>
          <p className="text-white/60 text-sm text-center mb-6">
            {mode === 'signin'
              ? 'Entre para acessar sua área de membros.'
              : 'Cadastre-se para assinar e acessar o conteúdo exclusivo.'}
          </p>

          {notice && (
            <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm px-4 py-3">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-red-600/10 border border-red-600/30 text-red-200 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/80">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-black/40 border-white/15 text-white placeholder:text-white/30"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="bg-black/40 border-white/15 text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-black/40 border-white/15 text-white placeholder:text-white/30"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-md cursor-pointer"
            >
              {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-white/40 text-xs uppercase tracking-wider">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => handleOAuth('google')}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-md cursor-pointer"
            >
              Entrar com Google
            </Button>
          </div>

          <p className="text-center text-white/60 text-sm mt-6">
            {mode === 'signin' ? (
              <>
                Ainda não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setNotice(null) }}
                  className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                >
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); setNotice(null) }}
                  className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
