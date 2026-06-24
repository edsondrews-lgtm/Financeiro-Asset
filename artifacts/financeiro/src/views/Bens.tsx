import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Car, Plus, X, Edit2, Trash2,
  Coins, Home, Trees, Bike, Briefcase, Landmark,
  Check, Search,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Bem {
  id: string
  nome: string
  categoria: string
  valor_estimado: number
  data_aquisicao: string | null
  descricao: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

const CATEGORIAS = [
  { value: 'carro', label: 'Carro', icon: Car, cor: 'blue' },
  { value: 'moto', label: 'Moto', icon: Bike, cor: 'orange' },
  { value: 'terreno', label: 'Terreno', icon: Trees, cor: 'emerald' },
  { value: 'imovel', label: 'Imóvel', icon: Home, cor: 'cyan' },
  { value: 'moveis', label: 'Móveis', icon: Landmark, cor: 'purple' },
  { value: 'eletronicos', label: 'Eletrônicos', icon: Briefcase, cor: 'indigo' },
  { value: 'outros', label: 'Outros', icon: Coins, cor: 'slate' },
]

function getCategoriaInfo(cat: string) {
  return CATEGORIAS.find(c => c.value === cat) || CATEGORIAS[CATEGORIAS.length - 1]
}

// ─── Modal: Novo/Editar Bem ───────────────────────────────────────────────────

function ModalBem({ bem, onFechar, onSalvo }: {
  bem?: Bem
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    nome: bem?.nome ?? '',
    categoria: bem?.categoria ?? 'carro',
    valor_estimado: bem?.valor_estimado?.toString() ?? '',
    data_aquisicao: bem?.data_aquisicao ?? '',
    descricao: bem?.descricao ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const editando = !!bem

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome) { setErro('Informe um nome.'); return }
    if (!form.valor_estimado || parseFloat(form.valor_estimado) <= 0) { setErro('Informe o valor estimado.'); return }
    setSalvando(true); setErro(null)

    const dados = {
      nome: form.nome,
      categoria: form.categoria,
      valor_estimado: parseFloat(form.valor_estimado),
      data_aquisicao: form.data_aquisicao || null,
      descricao: form.descricao || null,
    }

    let error
    if (editando) {
      ;({ error } = await supabase.from('bens').update(dados).eq('id', bem!.id))
    } else {
      ;({ error } = await supabase.from('bens').insert(dados))
    }

    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              {editando ? <Edit2 size={18} /> : <Plus size={18} />}
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {editando ? 'Editar Bem' : 'Novo Bem'}
            </h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome *</label>
            <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Honda Civic 2022" required autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Categoria *</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIAS.map(cat => {
                const Icon = cat.icon
                const selected = form.categoria === cat.value
                return (
                  <button key={cat.value} type="button" onClick={() => setForm({ ...form, categoria: cat.value })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-bold transition-all
                      ${selected
                        ? `bg-${cat.cor}-50 border-${cat.cor}-300 text-${cat.cor}-700`
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                    <Icon size={16} />
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor Estimado (R$) *</label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-amber-400">
              <span className="px-3 text-slate-400 text-sm font-bold bg-slate-50 py-2.5 border-r border-slate-200">R$</span>
              <input type="number" value={form.valor_estimado} onChange={e => setForm({ ...form, valor_estimado: e.target.value })}
                step="0.01" placeholder="0,00" required min="0"
                className="flex-1 px-3 py-2.5 text-sm text-slate-700 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Aquisição</label>
            <input type="date" value={form.data_aquisicao} onChange={e => setForm({ ...form, data_aquisicao: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
            <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2}
              placeholder="Ex: Financiado, quitado, etc."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Card do Bem ──────────────────────────────────────────────────────────────

function CardBem({ bem, onAtualizar }: { bem: Bem; onAtualizar: () => void }) {
  const [modalEditar, setModalEditar] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const catInfo = getCategoriaInfo(bem.categoria)
  const Icon = catInfo.icon

  async function excluir() {
    if (!confirm(`Excluir "${bem.nome}"? Esta ação não pode ser desfeita.`)) return
    setExcluindo(true)
    await supabase.from('bens').delete().eq('id', bem.id)
    onAtualizar()
  }

  return (
    <>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 bg-${catInfo.cor}-100 text-${catInfo.cor}-600 rounded-xl`}>
              <Icon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">{bem.nome}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{catInfo.label}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor Estimado</div>
          <div className="text-2xl font-black text-white mt-1 privado">{fmt(bem.valor_estimado)}</div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {bem.data_aquisicao && (
            <span>Aquisição: {fmtDate(bem.data_aquisicao)}</span>
          )}
          {bem.descricao && (
            <span className="italic truncate">{bem.descricao}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => setModalEditar(true)}
            className="flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-[10px] font-bold transition-all">
            <Edit2 size={12} /> Editar
          </button>
          <button onClick={excluir} disabled={excluindo}
            className="flex items-center justify-center gap-1.5 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-[10px] font-bold transition-all disabled:opacity-50">
            <Trash2 size={12} /> Excluir
          </button>
        </div>
      </div>

      {modalEditar && (
        <ModalBem bem={bem} onFechar={() => setModalEditar(false)} onSalvo={() => { setModalEditar(false); onAtualizar() }} />
      )}
    </>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function Bens() {
  const [bens, setBens] = useState<Bem[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('')

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('bens').select('*').order('created_at', { ascending: false })
    setBens(data || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const totalBens = bens.reduce((acc, b) => acc + b.valor_estimado, 0)

  const bensFiltrados = filtro
    ? bens.filter(b => b.categoria === filtro)
    : bens

  const totalPorCategoria = CATEGORIAS.map(cat => ({
    ...cat,
    total: bens.filter(b => b.categoria === cat.value).reduce((s, b) => s + b.valor_estimado, 0),
    count: bens.filter(b => b.categoria === cat.value).length,
  })).filter(c => c.count > 0)

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 rounded-xl text-white shadow-md shadow-amber-100">
            <Coins size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Meus Bens</h2>
            <p className="text-slate-500 text-sm">Patrimônio em bens de valor</p>
          </div>
        </div>
        <button onClick={() => setMostrarForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
          {mostrarForm ? <><X size={13} /> Fechar</> : <><Plus size={13} /> Novo bem</>}
        </button>
      </div>

      {/* Resumo */}
      {bens.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white shadow-sm">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total em Bens</div>
            <div className="text-2xl font-black text-white mt-1 privado">{fmt(totalBens)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{bens.length} bem{bens.length !== 1 ? 's' : ''} cadastrado{bens.length !== 1 ? 's' : ''}</div>
          </div>
          {totalPorCategoria.slice(0, 3).map(cat => {
            const Icon = cat.icon
            return (
              <div key={cat.value} className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between`}>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{cat.label}</div>
                  <div className="text-xl font-black text-slate-800 mt-1 privado">{fmt(cat.total)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{cat.count} item{cat.count !== 1 ? 'ens' : ''}</div>
                </div>
                <div className={`p-3 bg-${cat.cor}-50 text-${cat.cor}-600 rounded-xl`}>
                  <Icon size={20} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filtros */}
      {bens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFiltro('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
              ${!filtro ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            Todos ({bens.length})
          </button>
          {totalPorCategoria.map(cat => (
            <button key={cat.value} onClick={() => setFiltro(filtro === cat.value ? '' : cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                ${filtro === cat.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      )}

      {/* Formulário */}
      {mostrarForm && (
        <ModalBem onFechar={() => setMostrarForm(false)} onSalvo={() => { setMostrarForm(false); carregar() }} />
      )}

      {/* Lista */}
      {carregando ? (
        <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
      ) : bens.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🏠</p>
          <p className="text-sm font-medium">Nenhum bem cadastrado ainda.</p>
          <p className="text-xs mt-1 text-slate-300">Clique em "Novo bem" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bensFiltrados.map(b => (
            <CardBem key={b.id} bem={b} onAtualizar={carregar} />
          ))}
        </div>
      )}
    </div>
  )
}
