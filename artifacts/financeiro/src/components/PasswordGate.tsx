import React, { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

const SENHA_CORRETA = 'financas2026'
const STORAGE_KEY = 'fh_auth'

interface Props {
  children: React.ReactNode
}

export default function PasswordGate({ children }: Props) {
  const [liberado, setLiberado] = useState(false)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'ok') {
      setLiberado(true)
    }
  }, [])

  function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (senha === SENHA_CORRETA) {
      localStorage.setItem(STORAGE_KEY, 'ok')
      setLiberado(true)
    } else {
      setErro(true)
      setSenha('')
      setTimeout(() => setErro(false), 2000)
    }
  }

  if (liberado) return <>{children}</>

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
          <div className="relative">
            <input
              type={mostrar ? 'text' : 'password'}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Senha"
              autoFocus
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
            <p className="text-xs text-rose-500 font-bold text-center">Senha incorreta</p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
