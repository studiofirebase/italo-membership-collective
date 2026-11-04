import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { isLocalAdminTestEnabled } from '@/lib/localAdminTest'
import { normalizePhone } from '@/lib/customer-details'
import { api } from '@/integrations/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Auth() {
  const navigate = useNavigate()
  const { signInLocalAdminTest, session, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const continueToCheckout = searchParams.get('continue') === 'checkout'
  const requestedMode = searchParams.get('mode')
  const [mode, setMode] = useState<'signin' | 'signup'>(() =>
    !isLocalAdminTestEnabled() && requestedMode === 'signup' ? 'signup' : 'signin',
  )
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedDataUse, setAcceptedDataUse] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (isLocalAdminTestEnabled()) {
      setMode('signin')
      return
    }
    setMode(requestedMode === 'signup' ? 'signup' : 'signin')
  }, [requestedMode])

  useEffect(() => {
    if (!continueToCheckout || loading || !session?.user) return
    window.sessionStorage.setItem('subscription-checkout-after-auth', 'pending')
    navigate('/', { replace: true })
  }, [continueToCheckout, loading, navigate, session?.user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const normalizedPhone = normalizePhone(phone)
    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Informe seu nome completo.')
        return
      }
      if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
        setError('Os e-mails não coincidem.')
        return
      }
      if (!acceptedDataUse) {
        setError('Confirme o uso dos seus dados para criar e gerenciar sua conta.')
        return
      }
      if (!normalizedPhone) {
        setError('Informe um celular válido. Para números de fora do Brasil, use o formato +código do país.')
        return
      }
    }
    setBusy(true)
    try {
      if (isLocalAdminTestEnabled()) {
        if (mode !== 'signin') {
          setError('O modo local de teste permite somente o acesso de demonstração.')
          return
        }
        if (!signInLocalAdminTest(email, password)) {
          setError('Credenciais locais inválidas. Confira a configuração de teste.')
          return
        }
        if (continueToCheckout) {
          window.sessionStorage.setItem('subscription-checkout-after-auth', 'pending')
          navigate('/')
          return
        }
        navigate('/admin')
        return
      }

      if (mode === 'signup') {
        if (continueToCheckout) {
          window.sessionStorage.setItem('subscription-checkout-after-auth', 'pending')
        }
        const { data, error } = await api.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              phone_number: normalizedPhone,
            },
            emailRedirectTo: continueToCheckout
              ? `${window.location.origin}/?continue=checkout`
              : window.location.origin,
          },
        })
        if (error) throw error
        if (!data.session) {
          setNotice(
            continueToCheckout
              ? 'Conta criada! Confirme o e-mail enviado; depois da confirmação, você voltará para abrir o checkout.'
              : 'Conta criada! Enviamos um e-mail de confirmação — clique no link para ativar sua conta.',
          )
          return
        }
        if (!continueToCheckout) await navigateAfterSignIn(data.user.id)
      } else {
        const { data, error } = await api.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) throw error
        if (!continueToCheckout) await navigateAfterSignIn(data.user.id)
      }
    } catch (err: unknown) {
      if (continueToCheckout && mode === 'signup') {
        window.sessionStorage.removeItem('subscription-checkout-after-auth')
      }
      const errorCode =
        typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
          ? err.code
          : ''
      const errorStatus =
        typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
          ? err.status
          : null
      const errorName = err instanceof Error ? err.name : 'UnknownError'
      const errorMessage = err instanceof Error ? err.message.toLowerCase() : ''

      if (mode === 'signin') {
        console.error('Falha no login Supabase.', {
          name: errorName,
          code: errorCode || null,
          status: errorStatus,
        })
        setError(
          errorCode === 'email_not_confirmed' || errorMessage.includes('email not confirmed')
            ? 'Confirme seu e-mail pelo link enviado antes de entrar.'
            : errorCode === 'invalid_credentials' || errorMessage.includes('invalid login credentials')
              ? 'E-mail ou senha incorretos. Se você ainda não tem conta nesta nova versão do site, clique em “Cadastre-se” para criar uma.'
              : errorCode === 'over_request_rate_limit' || errorStatus === 429
                ? 'Muitas tentativas de login. Aguarde um pouco e tente novamente.'
                : errorName === 'AuthRetryableFetchError' || errorMessage.includes('failed to fetch')
                  ? 'Não foi possível conectar ao serviço de autenticação. Verifique sua conexão e tente novamente.'
                  : errorStatus !== null
                    ? `O serviço de autenticação recusou o login (HTTP ${errorStatus}${errorCode ? ` · ${errorCode}` : ''}).`
                    : 'Não foi possível concluir o login. Tente novamente.',
        )
      } else {
        if (continueToCheckout) {
          window.sessionStorage.removeItem('subscription-checkout-after-auth')
        }
        setError(
          errorMessage.includes('already registered')
            ? 'Este e-mail já está cadastrado. Faça login.'
            : errorCode === 'over_email_send_rate_limit' || errorStatus === 429
              ? 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.'
              : errorCode === 'weak_password'
                ? 'Senha fraca. Use uma senha mais forte.'
                : errorCode === 'email_address_invalid'
                  ? 'Este e-mail não é aceito. Use outro endereço.'
                  : 'Não foi possível criar a conta. Verifique os dados e tente novamente.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const navigateAfterSignIn = async (userId: string) => {
    const { data: roles, error: roleError } = await api
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    if (roleError) {
      console.error('Não foi possível verificar o papel após o login.', roleError)
      navigate('/membros')
      return
    }
    navigate(roles.some((role) => role.role === 'admin') ? '/admin' : '/membros')
  }

  return (
    <div className="min-h-screen bg-[#090a0b] text-[#f7f7f6]">
      <header className="border-b border-[#414447] bg-[#111213]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#92979b] bg-[#26282a] font-bold">IS</span>
            <span className="font-bagel text-xl tracking-wide text-white">Italo Santos</span>
          </Link>
          <span className="rounded-full border border-[#777c80] px-3 py-1 text-center text-xs text-[#e1e3e4] sm:text-sm">
            Acesso à área de membros
          </span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-xl gap-6 px-4 py-6 sm:px-8 lg:py-10">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          aria-labelledby="auth-title"
          className="relative overflow-hidden rounded-[28px] border border-[#666b6f] bg-[#141516] p-5 shadow-2xl sm:p-8 lg:p-10"
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#505358] via-[#f2f3f3] to-[#484b50]" />
          <div className="mb-8 flex flex-wrap items-center gap-2" aria-label="Etapa de acesso">
            <span className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${mode === 'signup' ? 'border-white bg-[#e0e2e3] text-[#111213]' : 'border-[#64696d] bg-[#252729] text-[#c9ccce]'}`}>
              {mode === 'signup' ? '01 · Cadastro' : 'Acesso seguro'}
            </span>
          </div>

          <span className="text-xs font-bold uppercase tracking-[.15em] text-[#c9ccce]">
            {isLocalAdminTestEnabled()
              ? 'MODO DE TESTE LOCAL'
              : mode === 'signup' ? 'Comece por aqui' : 'Que bom ter você de volta'}
          </span>
          <h2 id="auth-title" className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">
            {mode === 'signin' ? 'Entre na sua conta' : 'Crie seu cadastro'}
          </h2>
          <p className="mb-6 mt-3 leading-relaxed text-[#c9ccce]">
            {continueToCheckout
              ? 'Entre ou crie sua conta para continuar ao checkout da assinatura.'
              : isLocalAdminTestEnabled()
              ? 'Entre com as credenciais de demonstração para visualizar o painel sem alterar dados do Supabase.'
              : mode === 'signin'
              ? 'Informe seus dados para acessar sua área de membros.'
              : 'Preencha seus dados para criar sua conta e acessar conteúdos exclusivos.'}
          </p>

          {notice && (
            <div role="status" className="mb-5 rounded-xl border border-emerald-300/40 bg-emerald-950/50 p-4 text-sm leading-relaxed text-emerald-100">
              {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-[#e8a49e] bg-[#3a2222] p-4 text-sm leading-relaxed text-[#ffe5e2]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Nome completo</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="h-12 rounded-xl border-[#777c80] bg-[#202224] text-white placeholder:text-[#aeb2b5] focus-visible:ring-white"
                />
              </div>
            )}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">Celular</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999 ou +1 202 555 0123"
                  className="h-12 rounded-xl border-[#777c80] bg-[#202224] text-white placeholder:text-[#aeb2b5] focus-visible:ring-white"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="h-12 rounded-xl border-[#777c80] bg-[#202224] text-white placeholder:text-[#aeb2b5] focus-visible:ring-white"
              />
            </div>
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirm-email" className="text-white">Confirme seu e-mail</Label>
                <Input
                  id="confirm-email"
                  name="confirm-email"
                  type="email"
                  autoComplete="off"
                  inputMode="email"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Digite seu e-mail novamente"
                  className="h-12 rounded-xl border-[#777c80] bg-[#202224] text-white placeholder:text-[#aeb2b5] focus-visible:ring-white"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="h-12 rounded-xl border-[#777c80] bg-[#202224] text-white placeholder:text-[#aeb2b5] focus-visible:ring-white"
              />
            </div>
            {mode === 'signup' && (
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[#e0e2e3]">
                <input
                  type="checkbox"
                  required
                  checked={acceptedDataUse}
                  onChange={(e) => setAcceptedDataUse(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#d9dcde]"
                />
                <span>Concordo com o uso dos meus dados para criar e gerenciar minha conta.</span>
              </label>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#d9dcde] py-6 font-bold text-[#111213] transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar minha conta'}
            </Button>
          </form>

          {!isLocalAdminTestEnabled() && <p className="mt-6 text-center text-sm text-[#c9ccce]">
            {mode === 'signin' ? (
              <>
                Ainda não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setNotice(null) }}
                  className="font-semibold text-white underline underline-offset-4 hover:text-[#d9dcde]"
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
                  className="font-semibold text-white underline underline-offset-4 hover:text-[#d9dcde]"
                >
                  Entrar
                </button>
              </>
            )}
          </p>}
        </motion.section>
      </main>
    </div>
  )
}
