import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Zap, Loader2, Eye, EyeOff } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState('login') // login | signup | magic
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email })
        if (error) throw error
        setSuccess('Magic link enviado a tu email.')
        return
      }
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } }
        })
        if (error) throw error
        // Create profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('profiles').upsert({ id: user.id, email, name, plan: 'free' })
        }
        setSuccess('Cuenta creada. Revisa tu email para confirmar.')
        return
      }
      // Login
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600 rounded-2xl mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Zen Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Tu espacio de trabajo todo-en-uno</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-900 rounded-xl p-1 mb-6">
          {[['login', 'Entrar'], ['signup', 'Registrarse'], ['magic', 'Magic Link']].map(([m, l]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${
                mode === m ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="label">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="input"
                required
              />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="input"
              required
            />
          </div>
          {mode !== 'magic' && (
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(o => !o)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</div>
          )}
          {success && (
            <div className="text-sm text-green-400 bg-green-400/10 rounded-lg px-3 py-2">{success}</div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-2.5 text-base">
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {mode === 'login' ? 'Iniciar sesión' : mode === 'signup' ? 'Crear cuenta' : 'Enviar magic link'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Al continuar aceptas los términos de uso.
        </p>
      </div>
    </div>
  )
}
