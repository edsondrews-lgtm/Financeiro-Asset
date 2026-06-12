import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { FileText, Plus, X, Trash2, TrendingUp } from 'lucide-react'

interface Consorcio {
  id: string
  descricao: string
  administradora: string | null
  valor_credito: number
  valor_parcela: number
  parcelas_pagas: number
  total_parcelas: number
  data_inicio: string
  contemplado: boolean
  notas: string | null
}

const formVazio = {
  descricao: '',
  administradora: '',
  valor_credito: '',
  valor_parcela: '',
  parcelas_pagas: '',
  total_parcelas: '',
  data_inicio: new Date().toISOString().split('T')[0],
  contemplado: false,
  notas: '',
}

export default function Consorcios() {
  const [consorcios, setConsorcios] = useState<Consorcio[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  async function carregar() {
    const { data, error } = await supabase
      .from('consorcios')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { setErro('Erro ao carregar: ' + error.message); return }
    setConsorcios(data || [])
  }

  useEffect(() => { carregar() }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setSucesso(null)
    if (!form.descricao || !form.valor_credito || !form.valor_parcela || !form.total_parcelas) {
      setErro('Preencha todos os campos obrigatórios.'); return
    }
    setSalvando(true)
    const { error } = await supabase.from('consorcios').insert({
      descricao: form.descricao,
      administradora: form.administradora || null,
      valor_credito: parseFloat(form.valor_credito),
      valor_parcela: parseFloat(form.valor_parcela),
      parcelas_pagas: parseInt(form.parcelas_pagas) || 0,
      total_parcelas: parseInt(form.total_parcelas),
      data_inicio: form.data_inicio,
      contemplado: form.contemplado,
      notas: form.notas || null,
    })
    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setSucesso('Consórcio cadastrado!')
    setForm(formVazio); setMostrarForm(false)
    await carregar()
    setTimeout(() => setSucesso(null), 3000)
  }

  async function remover(id: string, descricao: string) {
    if (!confirm(`Remover "${descricao}"?`)) return
    setRemovendo(id)
    await supabase.from('consorcios').delete().eq('id', id)
    setRemovendo(null)
    setConsorcios(prev => prev.filter(c => c.id !== id))
  }

  async function toggleContemplado(id: string, atual: boolean) {
    await supabase.from('consorcios').update({ contemplado: !atual }).eq('id', id)
    setConsorcios(prev => prev.map(c => c.id === id ? { ...c, contemplado: !atual } : c))
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const totalCredito = consorcios.reduce((acc, c) => acc + c.valor_credito, 0)
  const totalPago = consorcios.reduce((acc, c) => acc + c.valor_parcela * c.parcelas_pagas, 0)
  const contemplados = consorcios.filter(c => c.contemplado).length

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-600 rounded-xl text-white shadow-md shadow-violet-100">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Consórcios</h2>
            <p className="text-slate-500 text-sm font-medium">Acompanhe seus consórcios e parcelas</p>
          </div>
        </div>
        <button
          onClick={() => { setMostrarForm(!mostrarForm); setErro(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
        >
          {mostrarForm ? <><X size={13} /> Fechar</> : <><Plus size={13} /> Novo consórcio</>}
        </button>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">{erro}</div>}
      {sucesso && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium">✓ {sucesso}</div>}

      {consorcios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Total em Crédito</span>
              <h3 className="text-2xl font-black text-slate-800">{fmt(totalCredito)}</h3>
              <span className="text-[10px] text-slate-500">{consorcios.length} consórcio(s)</span>
            </div>
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl"><FileText size={20} /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Total Pago</span>
              <h3 className="text-2xl font-black text-slate-800">{fmt(totalPago)}</h3>
              <span className="text-[10px] text-slate-500">Soma das parcelas pagas</span>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Contemplados</span>
              <h3 className="text-2xl font-black text-emerald-600">{contemplados} / {consorcios.length}</h3>
              <span className="text-[10px] text-slate-500">Cartas contempladas</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
          </div>
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Novo consórcio</h3>
          <form onSubmit={salvar}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição *</label>
                <input type="text" placeholder="Ex: Consórcio imóvel Itaú" value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Administradora</label>
                <input type="text" placeholder="Ex: Embracon" value={form.administradora}
                  onChange={e => setForm({ ...form, administradora: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor do Crédito (R$) *</label>
                <input type="number" placeholder="250000" min="0" step="0.01" value={form.valor_credito}
                  onChange={e => setForm({ ...form, valor_credito: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor da Parcela (R$) *</label>
                <input type="number" placeholder="1500" min="0" step="0.01" value={form.valor_parcela}
                  onChange={e => setForm({ ...form, valor_parcela: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total de Parcelas *</label>
                <input type="number" placeholder="200" min="1" step="1" value={form.total_parcelas}
                  onChange={e => setForm({ ...form, total_parcelas: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Parcelas Pagas</label>
                <input type="number" placeholder="0" min="0" step="1" value={form.parcelas_pagas}
                  onChange={e => setForm({ ...form, parcelas_pagas: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Início</label>
                <input type="date" value={form.data_inicio}
                  onChange={e => setForm({ ...form, data_inicio: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notas</label>
                <input type="text" placeholder="Observações (opcional)" value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.contemplado}
                    onChange={e => setForm({ ...form, contemplado: e.target.checked })}
                    className="w-4 h-4 accent-violet-600" />
                  <span className="text-sm font-medium text-slate-600">Já contemplado</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={salvando}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar consórcio'}
              </button>
            </div>
          </form>
        </div>
      )}

      {consorcios.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-medium">Nenhum consórcio cadastrado ainda.</p>
          <p className="text-xs mt-1 text-slate-300">Clique em "Novo consórcio" para começar.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="text-left px-6 py-4">Descrição</th>
                  <th className="text-left px-4 py-4">Administradora</th>
                  <th className="text-right px-4 py-4">Crédito</th>
                  <th className="text-right px-4 py-4">Parcela</th>
                  <th className="text-right px-4 py-4">Progresso</th>
                  <th className="text-right px-4 py-4">Total Pago</th>
                  <th className="text-center px-4 py-4">Contemplado</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {consorcios.map(c => {
                  const pct = c.total_parcelas > 0 ? (c.parcelas_pagas / c.total_parcelas) * 100 : 0
                  const totalPagoItem = c.valor_parcela * c.parcelas_pagas
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{c.descricao}</div>
                        {c.notas && <div className="text-xs text-slate-400 mt-0.5">{c.notas}</div>}
                      </td>
                      <td className="px-4 py-4 text-slate-500">{c.administradora || '—'}</td>
                      <td className="px-4 py-4 text-right font-bold text-slate-800">{fmt(c.valor_credito)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{fmt(c.valor_parcela)}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 font-medium w-20 text-right">
                            {c.parcelas_pagas}/{c.total_parcelas} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-600">{fmt(totalPagoItem)}</td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => toggleContemplado(c.id, c.contemplado)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                            c.contemplado ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}>
                          {c.contemplado ? '✓ Sim' : 'Não'}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button onClick={() => remover(c.id, c.descricao)} disabled={removendo === c.id}
                          className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
