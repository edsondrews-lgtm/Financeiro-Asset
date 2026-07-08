import React, { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface Props {
  children: React.ReactNode
}

export default function PasswordGate({ children }: Props) {
  const [session, setSession]     = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [email, setEmail]         = useState('')
  const [senha, setSenha]         = useState('')
  const [erro, setErro]           = useState('')
  const [mostrar, setMostrar]     = useState(false)
  const [enviando, setEnviando]   = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('E-mail ou senha inválidos')
      setSenha('')
    }
    setEnviando(false)
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (session) return <>{children}</>

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-100">
            <Lock size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">FinançasHub</h1>
            <p className="text-slate-400 text-sm mt-1">Acesso restrito</p>
          </div>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-mail"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-400 focus:bg-white"
          />

          <div className="relative">
            <input
              type={mostrar ? 'text' : 'password'}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Senha"
              className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm font-medium outline-none transition-all
                ${erro
                  ? 'border-rose-400 bg-rose-50 text-rose-700 placeholder-rose-300'
                  : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-400 focus:bg-white'
                }`}
            />
            <button
              type="button"
              onClick={() => setMostrar(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {erro && (
            <p className="text-xs text-rose-500 font-bold text-center">{erro}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
          >
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
