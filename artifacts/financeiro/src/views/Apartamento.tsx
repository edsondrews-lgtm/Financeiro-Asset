import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Home, Plus, X, Trash2, Edit2, Check, History,
  TrendingUp, Calendar, RefreshCw, ChevronDown, ChevronUp,
  DollarSign, BarChart3, Clock, AlertTriangle, Zap, Brain, Sparkles,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Imovel {
  id: string
  nome: string
  endereco: string
  area_privativa: number
  area_total: number
  andar: number
  vaga: string
  valor_original: number
  total_parcelas: number
  parcelas_cubs: number
  data_inicio_parcelas: string
  data_entrega_chaves: string
  cub_referencia_original: number
}

interface CubRegistro {
  id: string
  mes_ano: string
  valor_cub: number
  data_registro: string
}

interface Parcela {
  id: string
  numero_parcela: number
  data_pagamento: string
  cub_usado: number
  valor_pago: number
  observacao: string | null
  adiantada: boolean
}

interface Reforco {
  id: string
  descricao: string
  valor_reais: number
  valor_cubs: number | null
  data_pagamento: string
  tipo: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

function mesesAte(dataStr: string): number {
  const hoje = new Date()
  const alvo = new Date(dataStr + 'T12:00:00')
  return Math.max(0, (alvo.getFullYear() - hoje.getFullYear()) * 12 + (alvo.getMonth() - hoje.getMonth()))
}

function progressoTempo(dataInicio: string, dataFim: string): number {
  const inicio = new Date(dataInicio + 'T12:00:00').getTime()
  const fim = new Date(dataFim + 'T12:00:00').getTime()
  const hoje = new Date().getTime()
  return Math.min(100, Math.max(0, ((hoje - inicio) / (fim - inicio)) * 100))
}

// CUB efetivo: nunca diminui
function cubEfetivo(historico: CubRegistro[]): number {
  if (historico.length === 0) return 0
  return Math.max(...historico.map(c => c.valor_cub))
}

function cubAtual(historico: CubRegistro[]): CubRegistro | null {
  if (historico.length === 0) return null
  return [...historico].sort((a, b) => b.data_registro.localeCompare(a.data_registro))[0]
}

// Valor da parcela = cubs × cub_efetivo
function calcularParcela(cubs: number, cub: number): number {
  return parseFloat((cubs * cub).toFixed(2))
}

// Após entrega das chaves: parcela + 1% ao mês
function calcularParcelaComJuros(cubs: number, cub: number, dataEntrega: string, dataParcela: string): number {
  const base = calcularParcela(cubs, cub)
  const entrega = new Date(dataEntrega + 'T12:00:00')
  const parcela = new Date(dataParcela + 'T12:00:00')
  if (parcela <= entrega) return base
  const meses = Math.max(0,
    (parcela.getFullYear() - entrega.getFullYear()) * 12 +
    (parcela.getMonth() - entrega.getMonth())
  )
  return parseFloat((base * Math.pow(1.01, meses)).toFixed(2))
}

// ─── Modal: Registrar CUB ─────────────────────────────────────────────────────

function ModalCub({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const hoje = new Date()
  const mesAtual = `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
  const [form, setForm] = useState({ mes_ano: mesAtual, valor_cub: '', data_registro: hoje.toISOString().split('T')[0] })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(form.valor_cub)
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }
    setSalvando(true); setErro(null)
    const { error } = await supabase.from('imovel_cub').upsert({
      mes_ano: form.mes_ano, valor_cub: valor, data_registro: form.data_registro,
    }, { onConflict: 'mes_ano' })
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><RefreshCw size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Atualizar CUB</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        <p className="text-xs text-slate-500">
          O CUB nunca diminui. Se o valor informado for menor que o anterior, o sistema mantém o maior.
        </p>

        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mês/Ano *</label>
            <input type="text" value={form.mes_ano} onChange={e => setForm({ ...form, mes_ano: e.target.value })}
              placeholder="MM/YYYY" required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor CUB (R$) *</label>
            <input type="number" value={form.valor_cub} onChange={e => setForm({ ...form, valor_cub: e.target.value })}
              step="0.01" placeholder="Ex: 3096.25" required autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data do Registro *</label>
            <input type="date" value={form.data_registro} onChange={e => setForm({ ...form, data_registro: e.target.value })} required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              <Check size={13} /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Registrar Parcela ─────────────────────────────────────────────────

function ModalParcela({
  imovel, cubEfetivoValor, proximaParcela, onFechar, onSalvo,
}: {
  imovel: Imovel
  cubEfetivoValor: number
  proximaParcela: number
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    numero_parcela: proximaParcela.toString(),
    data_pagamento: new Date().toISOString().split('T')[0],
    cub_usado: cubEfetivoValor.toFixed(2),
    valor_pago: calcularParcela(imovel.parcelas_cubs, cubEfetivoValor).toFixed(2),
    observacao: '',
    adiantada: false,
    quantidade: '1',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Recalcula valor ao mudar CUB
  function atualizarCub(val: string) {
    const cub = parseFloat(val)
    const valor = isNaN(cub) ? '' : calcularParcela(imovel.parcelas_cubs, cub).toFixed(2)
    setForm(f => ({ ...f, cub_usado: val, valor_pago: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const qtd = parseInt(form.quantidade) || 1
    const numInicial = parseInt(form.numero_parcela)
    if (isNaN(numInicial) || numInicial < 1) { setErro('Número de parcela inválido.'); return }
    setSalvando(true); setErro(null)

    const parcelas = Array.from({ length: qtd }, (_, i) => ({
      numero_parcela: numInicial + i,
      data_pagamento: form.data_pagamento,
      cub_usado: parseFloat(form.cub_usado),
      valor_pago: parseFloat(form.valor_pago),
      observacao: form.observacao || null,
      adiantada: form.adiantada,
    }))

    const { error } = await supabase.from('imovel_parcelas').upsert(parcelas, { onConflict: 'numero_parcela' })
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Plus size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Registrar Parcela Paga</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nº Parcela *</label>
              <input type="number" value={form.numero_parcela} onChange={e => setForm({ ...form, numero_parcela: e.target.value })}
                min="1" max="100" required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quantidade</label>
              <input type="number" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })}
                min="1" max="10"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data do Pagamento *</label>
            <input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">CUB Usado (R$) *</label>
              <input type="number" value={form.cub_usado} onChange={e => atualizarCub(e.target.value)}
                step="0.01" required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor Pago (R$) *</label>
              <input type="number" value={form.valor_pago} onChange={e => setForm({ ...form, valor_pago: e.target.value })}
                step="0.01" required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          {/* Badge: parcela adiantada */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setForm(f => ({ ...f, adiantada: !f.adiantada }))}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${form.adiantada ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              <Zap size={12} /> {form.adiantada ? 'Parcela Adiantada ✓' : 'Marcar como Adiantada'}
            </button>
            {form.adiantada && <span className="text-[10px] text-amber-500">Será contabilizada como economia</span>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observação</label>
            <input type="text" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })}
              placeholder="Ex: Cheque Sicoob"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              <Check size={13} /> {salvando ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Novo Reforço ──────────────────────────────────────────────────────

const CUBS_ESCRITURA = 29.6215

function ModalReforco({ cubAtualValor, cubsPagosEscritura, onFechar, onSalvo }: {
  cubAtualValor: number
  cubsPagosEscritura: number
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    descricao: '', valor_reais: '', cubs_pagos: '',
    data_pagamento: new Date().toISOString().split('T')[0], tipo: 'reforco',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const isEscritura = form.tipo === 'escritura'
  const cubsRestantes = parseFloat((CUBS_ESCRITURA - cubsPagosEscritura).toFixed(4))
  const valorEscrituraHoje = parseFloat((cubsRestantes * cubAtualValor).toFixed(2))

  function atualizarReais(val: string) {
    const reais = parseFloat(val)
    if (isEscritura) {
      // Em escritura: calcula CUBs a partir do valor pago
      const cubs = cubAtualValor > 0 && !isNaN(reais) ? (reais / cubAtualValor).toFixed(4) : ''
      setForm(f => ({ ...f, valor_reais: val, cubs_pagos: cubs }))
    } else {
      setForm(f => ({ ...f, valor_reais: val, cubs_pagos: '' }))
    }
  }

  function preencherEscrituraTotal() {
    setForm(f => ({
      ...f,
      descricao: 'Pagamento Escritura',
      valor_reais: valorEscrituraHoje.toFixed(2),
      cubs_pagos: cubsRestantes.toFixed(4),
    }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(form.valor_reais)
    if (isNaN(valor) || valor <= 0) { setErro('Valor inválido.'); return }

    if (isEscritura) {
      const cubs = parseFloat(form.cubs_pagos)
      if (isNaN(cubs) || cubs <= 0) { setErro('Informe os CUBs pagos.'); return }
      if (cubs > cubsRestantes + 0.001) { setErro(`Máximo de CUBs restantes: ${cubsRestantes}`); return }
    }

    setSalvando(true); setErro(null)
    const { error } = await supabase.from('imovel_reforcos').insert({
      descricao: form.descricao || (isEscritura ? 'Pagamento Escritura' : 'Reforço'),
      valor_reais: valor,
      valor_cubs: isEscritura ? parseFloat(form.cubs_pagos) : null,
      cubs_pagos: isEscritura ? parseFloat(form.cubs_pagos) : null,
      is_escritura: isEscritura,
      data_pagamento: form.data_pagamento,
      tipo: form.tipo,
    })
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Plus size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Adicionar Reforço / Escritura</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, cubs_pagos: '', valor_reais: '', descricao: '' })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
              <option value="entrada">Entrada / Sinal</option>
              <option value="reforco">Reforço</option>
              <option value="escritura">🏠 Entrega de Chaves / Escritura</option>
            </select>
          </div>

          {/* Painel especial escritura */}
          {isEscritura && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">Situação da Escritura</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-purple-400 font-bold">Total Contrato</div>
                  <div className="text-sm font-black text-purple-700">{CUBS_ESCRITURA} CUBs</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-600 font-bold">Já Pago</div>
                  <div className="text-sm font-black text-emerald-600">{cubsPagosEscritura.toFixed(4)} CUBs</div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-500 font-bold">Restante</div>
                  <div className="text-sm font-black text-rose-500">{cubsRestantes.toFixed(4)} CUBs</div>
                </div>
              </div>
              <div className="w-full bg-white rounded-full h-2">
                <div className="h-2 bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (cubsPagosEscritura / CUBS_ESCRITURA) * 100)}%` }} />
              </div>
              <div className="text-xs text-purple-600 font-semibold text-center">
                Valor restante hoje: <span className="font-black">{fmt(valorEscrituraHoje)}</span>
              </div>
              {cubsRestantes > 0 && (
                <button type="button" onClick={preencherEscrituraTotal}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all">
                  Pagar valor total restante ({fmt(valorEscrituraHoje)})
                </button>
              )}
              {cubsRestantes <= 0 && (
                <div className="text-center text-emerald-600 font-bold text-xs">✓ Escritura totalmente quitada!</div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição *</label>
            <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder={isEscritura ? 'Ex: Pagamento Escritura (parcial)' : 'Ex: 3º Reforço da Reserva'} required autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor R$ *</label>
              <input type="number" value={form.valor_reais} onChange={e => atualizarReais(e.target.value)}
                step="0.01" placeholder="0,00" required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
            {isEscritura ? (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">CUBs Pagos *</label>
                <input type="number" value={form.cubs_pagos} onChange={e => setForm({ ...form, cubs_pagos: e.target.value })}
                  step="0.0001" placeholder={`Máx: ${cubsRestantes}`} max={cubsRestantes}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Em CUBs</label>
                <input type="number" value={form.cubs_pagos} onChange={e => setForm({ ...form, cubs_pagos: e.target.value })}
                  step="0.0001" placeholder="Auto"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data *</label>
            <input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              <Check size={13} /> {salvando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Histórico CUB ─────────────────────────────────────────────────────

function ModalHistoricoCub({ historico, imovel, onFechar, onAtualizar }: {
  historico: CubRegistro[]
  imovel: Imovel
  onFechar: () => void
  onAtualizar: () => void
}) {
  const sorted = [...historico].sort((a, b) => b.data_registro.localeCompare(a.data_registro))

  async function excluir(id: string) {
    if (!confirm('Excluir este registro de CUB?')) return
    await supabase.from('imovel_cub').delete().eq('id', id)
    onAtualizar()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><History size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Evolução do CUB</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b-2 border-slate-100">
                <th className="text-left py-2.5 pr-3">Mês/Ano</th>
                <th className="text-right py-2.5 pr-3">Valor CUB</th>
                <th className="text-right py-2.5 pr-3">Valor Parcela</th>
                <th className="text-left py-2.5 pr-3">Data Registro</th>
                <th className="text-center py-2.5">Status</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((c, i) => {
                const valorParcela = calcularParcela(imovel.parcelas_cubs, c.valor_cub)
                const isAtual = i === 0
                return (
                  <tr key={c.id} className={`hover:bg-slate-50/70 ${isAtual ? 'bg-amber-50/40' : ''}`}>
                    <td className="py-3 pr-3 font-bold text-slate-700">{c.mes_ano}</td>
                    <td className="py-3 pr-3 text-right font-black text-slate-800">{fmt(c.valor_cub)}</td>
                    <td className="py-3 pr-3 text-right text-emerald-600 font-bold">{fmt(valorParcela)}</td>
                    <td className="py-3 pr-3 text-slate-400">{fmtDate(c.data_registro)}</td>
                    <td className="py-3 pr-3 text-center">
                      {isAtual
                        ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">Vigente</span>
                        : <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[10px]">Histórico</span>}
                    </td>
                    <td className="py-3 text-right">
                      {!isAtual && (
                        <button onClick={() => excluir(c.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button onClick={onFechar} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Análise & Comparativo ────────────────────────────────────────────────

const TAXAS_MERCADO = [
  { label: 'Caixa — SFH (TR)',  taxa: 10.99 },
  { label: 'Caixa — IPCA',      taxa: 8.19  },
  { label: 'Itaú',              taxa: 11.49 },
  { label: 'Bradesco',          taxa: 11.20 },
  { label: 'Santander',         taxa: 11.09 },
  { label: 'BB — SFH',          taxa: 10.50 },
  { label: 'Personalizado',     taxa: 0     },
]

function AbaAnalise({ historicoCub, imovel, totalPago, valorAtualizado, parcelas, reforcos, economiaAdiantamentos, cubEfetivoValor }: {
  historicoCub: CubRegistro[]
  imovel: Imovel
  totalPago: number
  valorAtualizado: number
  parcelas: Parcela[]
  reforcos: Reforco[]
  economiaAdiantamentos: number
  cubEfetivoValor: number
}) {
  const [analise, setAnalise] = useState<string>('')
  const [carregandoAnalise, setCarregandoAnalise] = useState(false)
  const [cdiData, setCdiData] = useState<{ mes: string; cdi: number }[]>([])
  const [carregandoCDI, setCarregandoCDI] = useState(true)
  const [taxaSelecionada, setTaxaSelecionada] = useState(TAXAS_MERCADO[0])
  const [taxaCustom, setTaxaCustom] = useState('10.99')

  // Busca CDI mensal do Banco Central (série 4391 = CDI mensal %)
  useEffect(() => {
    async function buscarCDI() {
      try {
        const res = await fetch(
          'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados?formato=json&dataInicial=01/12/2022'
        )
        const data = await res.json()
        const mapped = (data as any[]).map((d: any) => ({
          mes: d.data,
          cdi: parseFloat(d.valor),
        }))
        setCdiData(mapped)
      } catch {
        setCdiData([])
      } finally {
        setCarregandoCDI(false)
      }
    }
    buscarCDI()
  }, [])

  // Taxa de financiamento efetiva
  const taxaAnual = taxaSelecionada.label === 'Personalizado' ? parseFloat(taxaCustom) || 0 : taxaSelecionada.taxa
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1

  // Monta série CUB — índice base 100 em dez/2022
  const sorted = [...historicoCub].sort((a, b) => a.data_registro.localeCompare(b.data_registro))
  const cubBase = sorted[0]?.valor_cub ?? 1
  const seriesCUB = sorted.map(c => ({
    mes: c.mes_ano,
    valor: parseFloat(((c.valor_cub / cubBase) * 100).toFixed(2)),
  }))

  // Série CDI acumulado base 100
  let acumCDI = 100
  const seriesCDI: { mes: string; valor: number }[] = []
  cdiData.forEach(d => {
    acumCDI = acumCDI * (1 + d.cdi / 100)
    const [, mm, yyyy] = d.mes.split('/')
    seriesCDI.push({ mes: `${mm}/${yyyy}`, valor: parseFloat(acumCDI.toFixed(2)) })
  })

  // Série Financiamento — simula custo acumulado de um financiamento
  // Parte de 100 e cresce com juros compostos mensais
  const nMeses = seriesCUB.length
  const seriesFIN: { mes: string; valor: number }[] = seriesCUB.map((s, i) => ({
    mes: s.mes,
    valor: parseFloat((100 * Math.pow(1 + taxaMensal, i)).toFixed(2)),
  }))

  // Unifica meses
  const todosOsMeses = Array.from(new Set([
    ...seriesCUB.map(s => s.mes),
    ...seriesCDI.map(s => s.mes),
  ])).sort((a, b) => {
    const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/')
    return new Date(`${ya}-${ma}-01`).getTime() - new Date(`${yb}-${mb}-01`).getTime()
  })

  const cubPorMes = Object.fromEntries(seriesCUB.map(s => [s.mes, s.valor]))
  const cdiPorMes = Object.fromEntries(seriesCDI.map(s => [s.mes, s.valor]))
  const finPorMes = Object.fromEntries(seriesFIN.map(s => [s.mes, s.valor]))

  let lastCUB = 100
  const dadosFinal = todosOsMeses.map(mes => {
    if (cubPorMes[mes]) lastCUB = cubPorMes[mes]
    return {
      mes,
      cub: cubPorMes[mes] ?? lastCUB,
      cdi: cdiPorMes[mes] ?? null,
      fin: finPorMes[mes] ?? null,
    }
  })

  // Stats finais
  const cubFinal  = seriesCUB[seriesCUB.length - 1]?.valor ?? 100
  const cdiFinal  = seriesCDI[seriesCDI.length - 1]?.valor ?? 100
  const finFinal  = seriesFIN[seriesFIN.length - 1]?.valor ?? 100
  const cubVar    = parseFloat((cubFinal - 100).toFixed(2))
  const cdiVar    = parseFloat((cdiFinal - 100).toFixed(2))
  const finVar    = parseFloat((finFinal - 100).toFixed(2))
  const cubGanhaCDI = cubVar > cdiVar
  const economiaSobreFinanciamento = imovel.valor_original * (finVar - cubVar) / 100

  // SVG
  const W = 720, H = 300, PAD = { top: 20, right: 20, bottom: 40, left: 52 }
  const allV = dadosFinal.flatMap(d => [d.cub, d.cdi ?? 0, d.fin ?? 0]).filter(Boolean)
  const minV = Math.min(...allV) * 0.98
  const maxV = Math.max(...allV) * 1.02
  const xStep = (W - PAD.left - PAD.right) / Math.max(dadosFinal.length - 1, 1)
  const yS = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - minV) / (maxV - minV))

  const pathCUB = dadosFinal.map((d, i) => `${i === 0 ? 'M' : 'L'} ${PAD.left + i * xStep} ${yS(d.cub)}`).join(' ')
  const pathCDI = dadosFinal.filter(d => d.cdi !== null).map((d) => {
    const i = dadosFinal.findIndex(x => x.mes === d.mes)
    return `${dadosFinal.slice(0, i).every(x => x.cdi === null) ? 'M' : 'L'} ${PAD.left + i * xStep} ${yS(d.cdi!)}`
  }).join(' ')
  const pathFIN = dadosFinal.filter(d => d.fin !== null).map((d) => {
    const i = dadosFinal.findIndex(x => x.mes === d.mes)
    return `${dadosFinal.slice(0, i).every(x => x.fin === null) ? 'M' : 'L'} ${PAD.left + i * xStep} ${yS(d.fin!)}`
  }).join(' ')

  const labelsX = dadosFinal.filter((_, i) => i % 6 === 0 || i === dadosFinal.length - 1)
  const fmt2 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Análise local inteligente
  function gerarAnalise() {
    setCarregandoAnalise(true)
    setAnalise('')
    setTimeout(() => {
      const parcelasAdiantadasQtd = parcelas.filter(p => p.adiantada).length
      const parcelasNormaisQtd = parcelas.filter(p => !p.adiantada).length
      const mesesRestantes = Math.max(0,
        (new Date(imovel.data_entrega_chaves).getFullYear() - new Date().getFullYear()) * 12 +
        (new Date(imovel.data_entrega_chaves).getMonth() - new Date().getMonth())
      )
      const progresso = ((totalPago / valorAtualizado) * 100).toFixed(1)
      const valorRestante = valorAtualizado - totalPago
      const mediaMensal = parcelasNormaisQtd > 0 ? totalPago / parcelasNormaisQtd : 0

      // § 1 — CUB vs CDI
      const difCubCdi = Math.abs(cubVar - cdiVar).toFixed(1)
      const p1 = cubGanhaCDI
        ? `Desde dezembro de 2022, o CUB acumulou +${cubVar.toFixed(1)}%, superando o CDI 100% que rendeu +${cdiVar.toFixed(1)}% no mesmo período — uma vantagem de ${difCubCdi} pontos percentuais. Isso significa que o custo do seu apartamento corrigido pelo CUB está subindo mais do que a principal referência de renda fixa do Brasil. Em outras palavras, o imóvel está ficando mais caro em termos de reposição, mas como você já travou o preço no contrato, você se beneficia dessa valorização.`
        : `Desde dezembro de 2022, o CDI 100% acumulou +${cdiVar.toFixed(1)}%, superando o CUB que corrigiu +${cubVar.toFixed(1)}% no mesmo período — uma diferença de ${difCubCdi} pontos percentuais. Em termos puramente financeiros, o dinheiro renderia mais no CDI, mas isso não conta toda a história: você está construindo patrimônio imobiliário real com valorização de mercado que vai muito além do índice de construção.`

      // § 2 — Vs Financiamento bancário
      const economiaPretty = fmt2(Math.abs(economiaSobreFinanciamento))
      const p2 = `Comparando com um financiamento bancário pela ${taxaSelecionada.label} (${taxaAnual.toFixed(2)}% a.a.), o custo acumulado seria de +${finVar.toFixed(1)}% no mesmo período — enquanto o CUB corrigiu apenas +${cubVar.toFixed(1)}%. Isso representa uma economia estimada de ${economiaPretty} sobre o valor original do imóvel. Em resumo, comprar diretamente da construtora com correção por CUB foi significativamente mais barato do que teria sido um financiamento tradicional, que além dos juros ainda teria tarifas, seguros e IOF embutidos.`

      // § 3 — Adiantamentos
      const p3 = parcelasAdiantadasQtd > 0
        ? `A estratégia de adiantar ${parcelasAdiantadasQtd} parcelas foi inteligente e gerou uma economia real de ${fmt2(economiaAdiantamentos)}. Como o CUB tende a subir todo mês, cada parcela paga antecipadamente é sempre mais barata do que será no futuro. Com ${mesesRestantes} meses ainda pela frente até a entrega e o CUB em ${fmt2(cubEfetivoValor)}, continue adiantando sempre que tiver liquidez disponível — a economia se acumula mês a mês.`
        : `Você ainda não adiantou parcelas. Vale considerar: com o CUB em ${fmt2(cubEfetivoValor)} e tendência de alta, adiantar parcelas hoje significa pagar com o índice atual em vez do índice futuro mais alto. Com ${mesesRestantes} meses até a entrega, mesmo adiantando uma ou duas parcelas por mês a economia acumulada pode ser expressiva.`

      // § 4 — Situação geral
      const p4 = `No geral, o investimento está ${parseFloat(progresso) > 45 ? 'muito bem encaminhado' : 'no caminho certo'}. Você já pagou ${fmt2(totalPago)}, representando ${progresso}% do valor atualizado de ${fmt2(valorAtualizado)}. O valor restante estimado é de ${fmt2(valorRestante)}, incluindo parcelas mensais e a escritura na entrega. Com pagamentos em dia e média mensal de ${fmt2(mediaMensal)}, a tendência é chegar à entrega de dezembro/2027 com tranquilidade financeira. Recomendação: mantenha o ritmo, atualize o CUB todo mês e prepare uma reserva para a escritura.`

      setAnalise([p1, p2, p3, p4].join('\n\n'))
      setCarregandoAnalise(false)
    }, 800)
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Cards de comparação ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-1">
          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">CUB acumulado</div>
          <div className="text-2xl font-black text-indigo-700">+{cubVar.toFixed(1)}%</div>
          <div className="text-xs text-indigo-400">Dez/22 → hoje</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">CDI 100% acumulado</div>
          <div className="text-2xl font-black text-emerald-700">{carregandoCDI ? '...' : `+${cdiVar.toFixed(1)}%`}</div>
          <div className="text-xs text-emerald-400">Banco Central · BCB</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1">
          <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Financiamento bancário</div>
          <div className="text-2xl font-black text-rose-700">+{finVar.toFixed(1)}%</div>
          <div className="text-xs text-rose-400">{taxaAnual.toFixed(2)}% a.a. acumulado</div>
        </div>
        <div className={`rounded-2xl p-4 space-y-1 border ${economiaSobreFinanciamento > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Economia vs financiamento</div>
          <div className="text-2xl font-black text-amber-700">{fmt2(Math.abs(economiaSobreFinanciamento))}</div>
          <div className="text-xs text-amber-400">você pagou menos que um banco cobraria</div>
        </div>
      </div>

      {/* ── Seletor de taxa ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Taxa de Financiamento para Comparação</div>
        <div className="flex flex-wrap gap-2">
          {TAXAS_MERCADO.map(t => (
            <button key={t.label}
              onClick={() => setTaxaSelecionada(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${taxaSelecionada.label === t.label ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300'}`}>
              {t.label}{t.taxa > 0 ? ` · ${t.taxa}% a.a.` : ''}
            </button>
          ))}
        </div>
        {taxaSelecionada.label === 'Personalizado' && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500">Taxa anual (% a.a.):</label>
            <input type="number" value={taxaCustom} onChange={e => setTaxaCustom(e.target.value)}
              step="0.01" min="0" max="30"
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 focus:outline-none focus:border-rose-400 w-28" />
          </div>
        )}
      </div>

      {/* ── Gráfico SVG ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-sm font-black text-slate-700">CUB vs CDI vs Financiamento — Índice Base 100 (Dez/2022)</div>
            <div className="text-xs text-slate-400 mt-0.5">Evolução acumulada desde o início do contrato</div>
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-1.5"><div className="w-5 h-[3px] bg-indigo-500 rounded"/><span className="text-slate-500 font-semibold">CUB</span></div>
            <div className="flex items-center gap-1.5"><div className="w-5 h-[2px] bg-emerald-500 rounded" style={{borderTop:'2px dashed #10b981',background:'none'}}/><span className="text-slate-500 font-semibold">CDI 100%</span></div>
            <div className="flex items-center gap-1.5"><div className="w-5 h-[2px] bg-rose-400 rounded" style={{borderTop:'2px dotted #f87171',background:'none'}}/><span className="text-slate-500 font-semibold">Financiamento ({taxaAnual.toFixed(1)}% a.a.)</span></div>
          </div>
        </div>

        {carregandoCDI ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin"/> Carregando dados do Banco Central...
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
            {[0,25,50,75,100].map(pct => {
              const v = minV + (maxV - minV) * (pct / 100)
              const y = yS(v)
              return (
                <g key={pct}>
                  <line x1={PAD.left} y1={y} x2={W-PAD.right} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
                  <text x={PAD.left-6} y={y+4} textAnchor="end" fontSize="9" fill="#94a3b8">{v.toFixed(0)}</text>
                </g>
              )
            })}

            {/* Base 100 */}
            <line x1={PAD.left} y1={yS(100)} x2={W-PAD.right} y2={yS(100)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4"/>

            {/* Financiamento */}
            <path d={pathFIN} fill="none" stroke="#f87171" strokeWidth="2" strokeDasharray="3,3" opacity="0.9"/>

            {/* CDI */}
            <path d={pathCDI} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6,3" opacity="0.85"/>

            {/* CUB — destaque */}
            <path d={pathCUB} fill="none" stroke="#6366f1" strokeWidth="3"/>

            {/* Pontos finais */}
            {dadosFinal.length > 0 && (() => {
              const last = dadosFinal[dadosFinal.length - 1]
              const x = PAD.left + (dadosFinal.length - 1) * xStep
              return <>
                <circle cx={x} cy={yS(last.cub)} r="5" fill="#6366f1"/>
                {last.cdi && <circle cx={x} cy={yS(last.cdi)} r="4" fill="#10b981"/>}
                {last.fin && <circle cx={x} cy={yS(last.fin)} r="4" fill="#f87171"/>}
              </>
            })()}

            {/* Labels X */}
            {labelsX.map(d => {
              const i = dadosFinal.findIndex(x => x.mes === d.mes)
              return (
                <text key={d.mes} x={PAD.left + i * xStep} y={H-8} textAnchor="middle" fontSize="8" fill="#94a3b8">
                  {d.mes}
                </text>
              )
            })}
          </svg>
        )}
      </div>

      {/* ── Análise ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-violet-100 text-violet-600 rounded-lg"><Brain size={16}/></div>
            <div>
              <div className="text-sm font-black text-slate-700">Análise do Investimento</div>
              <div className="text-xs text-slate-400">Baseada nos seus dados reais</div>
            </div>
          </div>
          <button onClick={gerarAnalise} disabled={carregandoAnalise}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
            {carregandoAnalise
              ? <><RefreshCw size={12} className="animate-spin"/> Analisando...</>
              : <><Sparkles size={12}/> {analise ? 'Reanalisar' : 'Gerar Análise'}</>}
          </button>
        </div>

        <div className="p-5">
          {!analise && !carregandoAnalise && (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <Brain size={36} className="mx-auto opacity-20"/>
              <p className="text-sm">Clique em "Gerar Análise" para uma avaliação completa do seu investimento.</p>
            </div>
          )}
          {carregandoAnalise && (
            <div className="space-y-3 animate-pulse">
              {[1,2,3,4].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded-full w-full"/>
                  <div className="h-3 bg-slate-100 rounded-full w-5/6"/>
                  <div className="h-3 bg-slate-100 rounded-full w-4/5"/>
                </div>
              ))}
            </div>
          )}
          {analise && !carregandoAnalise && (
            <div className="space-y-4">
              {analise.split('\n\n').filter(p => p.trim()).map((p, i) => (
                <p key={i} className="text-sm text-slate-600 leading-relaxed">{p}</p>
              ))}
              <div className="pt-3 border-t border-slate-50 text-[10px] text-slate-300 flex items-center gap-1">
                <Sparkles size={10}/> Análise gerada com base nos seus dados reais · Atualizada agora
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── Componente Principal ─────────────────────────────────────────────────────

export default function Apartamento() {
  const [imovel, setImovel] = useState<Imovel | null>(null)
  const [historicoCub, setHistoricoCub] = useState<CubRegistro[]>([])
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [reforcos, setReforcos] = useState<Reforco[]>([])
  const [carregando, setCarregando] = useState(true)

  const [aba, setAba] = useState<'normais' | 'adiantadas' | 'reforcos' | 'cub' | 'analise'>('normais')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const porPagina = 15

  const [modalParcela, setModalParcela] = useState(false)
  const [modalReforco, setModalReforco] = useState(false)
  const [modalCub, setModalCub] = useState(false)
  const [modalHistCub, setModalHistCub] = useState(false)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [{ data: im }, { data: cub }, { data: parc }, { data: ref }] = await Promise.all([
      supabase.from('imovel').select('*').limit(1).single(),
      supabase.from('imovel_cub').select('*').order('data_registro', { ascending: false }),
      supabase.from('imovel_parcelas').select('*').order('numero_parcela', { ascending: true }),
      supabase.from('imovel_reforcos').select('*').order('data_pagamento', { ascending: true }),
    ])
    if (im) setImovel(im)
    setHistoricoCub(cub || [])
    setParcelas(parc || [])
    setReforcos(ref || [])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando...</div>
  if (!imovel) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Nenhum imóvel cadastrado.</div>

  const cubEfetivoValor = cubEfetivo(historicoCub)
  const cubAtualReg = cubAtual(historicoCub)
  const parcelasNormais = parcelas.filter(p => !p.adiantada)
  const parcelasAdiantadas = parcelas.filter(p => p.adiantada)
  const totalPagoNormais = parcelasNormais.reduce((s, p) => s + p.valor_pago, 0)
  const totalPagoAdiantadas = parcelasAdiantadas.reduce((s, p) => s + p.valor_pago, 0)
  const totalReforcos = reforcos.reduce((s, r) => s + r.valor_reais, 0)
  const totalPago = totalPagoNormais + totalPagoAdiantadas + totalReforcos

  const proximaParcela = parcelasNormais.length > 0
    ? Math.max(...parcelasNormais.map(p => p.numero_parcela)) + 1
    : 1

  const parcelasRestantes = imovel.total_parcelas - parcelasNormais.length - parcelasAdiantadas.length
  const proximaParcelaValor = calcularParcela(imovel.parcelas_cubs, cubEfetivoValor)
  const dataProximaParcela = (() => {
    const d = new Date(imovel.data_inicio_parcelas + 'T12:00:00')
    d.setMonth(d.getMonth() + proximaParcela - 1)
    return d.toISOString().split('T')[0]
  })()

  const totalCubsOriginal = imovel.valor_original / imovel.cub_referencia_original
  const valorAtualizado = totalCubsOriginal * cubEfetivoValor

  const economiaAdiantamentos = parcelasAdiantadas.reduce((s, p) => {
    const valorHoje = calcularParcela(imovel.parcelas_cubs, cubEfetivoValor)
    return s + Math.max(0, valorHoje - p.valor_pago)
  }, 0)

  const cubsEscrituraTotal = 29.6215
  const cubsPagosEscritura = reforcos
    .filter((r: any) => r.is_escritura)
    .reduce((s: number, r: any) => s + (Number(r.cubs_pagos) || 0), 0)
  const cubsRestantesEscritura = parseFloat((cubsEscrituraTotal - cubsPagosEscritura).toFixed(4))
  const valorEscrituraAtual = cubsRestantesEscritura * cubEfetivoValor
  const escrituraQuitada = cubsRestantesEscritura <= 0
  const totalRestante = parcelasRestantes * proximaParcelaValor + (escrituraQuitada ? 0 : valorEscrituraAtual)

  const progresso = totalPago / valorAtualizado * 100
  const mesesRestantes = mesesAte(imovel.data_entrega_chaves)
  const pctTempo = progressoTempo(imovel.data_inicio_parcelas, imovel.data_entrega_chaves)

  const listaAba = aba === 'normais' ? parcelasNormais
    : aba === 'adiantadas' ? parcelasAdiantadas
    : aba === 'reforcos' ? reforcos
    : aba === 'cub' ? historicoCub
    : []
  const totalPaginas = Math.ceil((listaAba as any[]).length / porPagina)
  const listaAtual = (listaAba as any[]).slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina)

  async function excluirParcela(id: string) {
    if (!confirm('Excluir esta parcela?')) return
    setExcluindo(id)
    await supabase.from('imovel_parcelas').delete().eq('id', id)
    await carregar()
    setExcluindo(null)
  }

  async function excluirReforco(id: string) {
    if (!confirm('Excluir este reforço?')) return
    setExcluindo(id)
    await supabase.from('imovel_reforcos').delete().eq('id', id)
    await carregar()
    setExcluindo(null)
  }

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
            <Home size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Imóvel</h2>
            <p className="text-slate-500 text-sm">{imovel.nome} · {imovel.endereco}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModalCub(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold">
            <RefreshCw size={13} /> Atualizar CUB
          </button>
          <button onClick={() => setModalHistCub(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold">
            <History size={13} /> Histórico CUB ({historicoCub.length})
          </button>
          <button onClick={() => carregar()}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-amber-500 p-5 rounded-2xl text-white shadow-sm space-y-1">
          <div className="text-xs text-amber-100 font-bold uppercase tracking-wider">CUB Atual ({cubAtualReg?.mes_ano})</div>
          <div className="text-3xl font-black">{fmt(cubEfetivoValor)}</div>
          <div className="text-xs text-amber-200">Próxima parcela: <span className="font-bold text-white">{fmt(proximaParcelaValor)}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Valor Atualizado</div>
          <div className="text-2xl font-black text-slate-800">{fmt(valorAtualizado)}</div>
          <div className="text-xs text-slate-400">
            Original: <span className="text-slate-600 font-semibold">{fmt(imovel.valor_original)}</span>
            {' · '}<span className="text-emerald-600 font-bold">+{fmt(valorAtualizado - imovel.valor_original)}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Pago</div>
          <div className="text-2xl font-black text-emerald-600">{fmt(totalPago)}</div>
          <div className="text-xs text-slate-400">de {fmt(valorAtualizado)} · <span className="font-bold text-slate-600">{progresso.toFixed(1)}% pago</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Clock size={13} /> Tempo até Entrega das Chaves
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full bg-cyan-400 transition-all" style={{ width: `${pctTempo}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-black text-cyan-500">{mesesRestantes} meses restantes</span>
            <span className="text-xs text-slate-400">Entrega prevista: {fmtDate(imovel.data_entrega_chaves)}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <TrendingUp size={13} /> Progresso do Pagamento
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, progresso)}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-black text-indigo-600">{fmt(totalPago)}</span>
            <span className="text-xs text-slate-400">{progresso.toFixed(1)}% · de {fmt(valorAtualizado)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><BarChart3 size={15} /></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Já Pago</span>
          </div>
          <div className="space-y-2 text-sm">
            {reforcos.map(r => (
              <div key={r.id} className="flex justify-between">
                <span className="text-slate-500 text-xs">{r.descricao}:</span>
                <span className="font-bold text-slate-700 text-xs">{fmt(r.valor_reais)}</span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-2 flex justify-between">
              <span className="text-slate-500 text-xs">{parcelasNormais.length} parcelas normais:</span>
              <span className="font-bold text-slate-700 text-xs">{fmt(totalPagoNormais)}</span>
            </div>
            {parcelasAdiantadas.length > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">{parcelasAdiantadas.length} adiantadas:</span>
                <span className="font-bold text-amber-600 text-xs">{fmt(totalPagoAdiantadas)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between">
              <span className="font-bold text-slate-700 text-xs">Total:</span>
              <span className="font-black text-emerald-600">{fmt(totalPago)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-500 rounded-lg"><DollarSign size={15} /></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total a Pagar</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 text-xs">{parcelasRestantes} parcelas × {fmt(proximaParcelaValor)}:</span>
              <span className="font-bold text-slate-700 text-xs">{fmt(parcelasRestantes * proximaParcelaValor)}</span>
            </div>
            <div className="flex justify-between">
              {escrituraQuitada ? (
                <span className="text-emerald-600 text-xs font-bold">✓ Escritura quitada!</span>
              ) : (
                <span className="text-slate-500 text-xs">Escritura ({cubsRestantesEscritura.toFixed(4)} CUBs restantes):</span>
              )}
              <span className={`font-bold text-xs ${escrituraQuitada ? 'text-emerald-600' : 'text-slate-700'}`}>
                {escrituraQuitada ? fmt(0) : fmt(valorEscrituraAtual)}
              </span>
            </div>
            {!escrituraQuitada && (
              <div className="text-[10px] text-purple-600 bg-purple-50 rounded-lg px-2 py-1">
                {cubsPagosEscritura > 0 && `${cubsPagosEscritura.toFixed(4)} CUBs já pagos · `}
                Total contrato: 29.6215 CUBs
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between">
              <span className="font-bold text-slate-700 text-xs">Total Restante:</span>
              <span className="font-black text-rose-500">{fmt(totalRestante)}</span>
            </div>
          </div>
          {mesesRestantes <= 24 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-xl p-2.5">
              <AlertTriangle size={12} /> Entrega em {mesesRestantes} meses
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 rounded-2xl text-white shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg"><Calendar size={15} /></div>
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Próxima Parcela</span>
          </div>
          <div className="text-3xl font-black">{fmt(proximaParcelaValor)}</div>
          <div className="text-xs text-indigo-200">Parcela #{proximaParcela} · {fmtDate(dataProximaParcela)}</div>
          <div className="text-xs text-indigo-200">{imovel.parcelas_cubs} CUBs × {fmt(cubEfetivoValor)}</div>
          {economiaAdiantamentos > 0 && (
            <div className="mt-2 pt-3 border-t border-indigo-500">
              <div className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Economia c/ Adiantamentos</div>
              <div className="text-xl font-black text-emerald-300 mt-0.5">{fmt(economiaAdiantamentos)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gerenciar Financiamento</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setModalParcela(true)}
            className="flex flex-col items-center gap-1.5 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Calendar size={16} /> Registrar Parcelas
          </button>
          <button onClick={() => setModalReforco(true)}
            className="flex flex-col items-center gap-1.5 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={16} /> Adicionar Reforço
          </button>
          <button onClick={() => setModalCub(true)}
            className="flex flex-col items-center gap-1.5 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all">
            <RefreshCw size={16} /> Atualizar CUB
          </button>
          <button onClick={() => setModalHistCub(true)}
            className="flex flex-col items-center gap-1.5 px-5 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-xl text-xs font-bold transition-all">
            <History size={16} /> Ver Histórico CUB
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'normais',   label: `Parcelas Normais (${parcelasNormais.length})` },
              { key: 'adiantadas',label: `Parcelas Adiantadas (${parcelasAdiantadas.length})` },
              { key: 'reforcos',  label: `Reforços (${reforcos.length})` },
              { key: 'cub',       label: `Histórico CUB (${historicoCub.length})` },
              { key: 'analise',   label: '🧠 Análise & Comparativo' },
            ] as const).map(a => (
              <button key={a.key} onClick={() => { setAba(a.key); setPaginaAtual(1) }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${aba === a.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {a.label}
              </button>
            ))}
          </div>
          {totalPaginas > 1 && aba !== 'analise' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1}
                className="p-1 disabled:opacity-30"><ChevronUp size={14} /></button>
              <span>Pág. {paginaAtual}/{totalPaginas}</span>
              <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual >= totalPaginas}
                className="p-1 disabled:opacity-30"><ChevronDown size={14} /></button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {aba === 'analise' && (
            <AbaAnalise
              historicoCub={historicoCub}
              imovel={imovel}
              totalPago={totalPago}
              valorAtualizado={valorAtualizado}
              parcelas={parcelas}
              reforcos={reforcos}
              economiaAdiantamentos={economiaAdiantamentos}
              cubEfetivoValor={cubEfetivoValor}
            />
          )}

          {(aba === 'normais' || aba === 'adiantadas') && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-50">
                  <th className="text-left px-5 py-3">Nº Parcela</th>
                  <th className="text-left px-4 py-3">Data Pagamento</th>
                  <th className="text-right px-4 py-3">CUB Usado</th>
                  <th className="text-right px-4 py-3">Valor Pago</th>
                  {aba === 'adiantadas' && <th className="text-right px-4 py-3">Valor Hoje</th>}
                  {aba === 'adiantadas' && <th className="text-right px-4 py-3">Economia</th>}
                  <th className="text-left px-4 py-3">Observação</th>
                  <th className="text-center px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(listaAtual as Parcela[]).map(p => {
                  const valorHoje = calcularParcela(imovel.parcelas_cubs, cubEfetivoValor)
                  const economia = Math.max(0, valorHoje - p.valor_pago)
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${p.adiantada ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          Parcela {p.numero_parcela}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(p.data_pagamento)}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{fmt(p.cub_usado)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmt(p.valor_pago)}</td>
                      {aba === 'adiantadas' && <td className="px-4 py-3 text-right text-xs text-slate-500">{fmt(valorHoje)}</td>}
                      {aba === 'adiantadas' && (
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{fmt(economia)}</span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-slate-400 italic">{p.observacao || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => excluirParcela(p.id)} disabled={excluindo === p.id}
                          className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {aba === 'adiantadas' && parcelasAdiantadas.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Economia Total com Adiantamentos:</td>
                    <td className="px-4 py-3 text-right">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-black">{fmt(economiaAdiantamentos)}</span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {aba === 'reforcos' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-50">
                  <th className="text-left px-5 py-3">Descrição</th>
                  <th className="text-right px-4 py-3">Valor R$</th>
                  <th className="text-right px-4 py-3">Valor CUBs</th>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-center px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(listaAtual as Reforco[]).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-700 text-xs">{r.descricao}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmt(r.valor_reais)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">{r.valor_cubs ? `${r.valor_cubs} CUBs` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.data_pagamento)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.tipo === 'entrada' ? 'bg-blue-100 text-blue-700' :
                        r.tipo === 'escritura' ? 'bg-purple-100 text-purple-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>{r.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => excluirReforco(r.id)} disabled={excluindo === r.id}
                        className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Total em Reforços:</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-600">{fmt(totalReforcos)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          )}

          {aba === 'cub' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-50">
                  <th className="text-left px-5 py-3">Valor CUB</th>
                  <th className="text-left px-4 py-3">Mês/Ano</th>
                  <th className="text-left px-4 py-3">Data Registro</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Valor Parcela</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {([...historicoCub].sort((a, b) => b.data_registro.localeCompare(a.data_registro)) as CubRegistro[])
                  .slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina)
                  .map((c, i) => {
                    const isAtual = i === 0 && paginaAtual === 1
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50/60 transition-colors ${isAtual ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-5 py-3 font-black text-slate-800">{fmt(c.valor_cub)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-bold">{c.mes_ano}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(c.data_registro)}</td>
                        <td className="px-4 py-3">
                          {isAtual
                            ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">Vigente</span>
                            : <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[10px]">Histórico</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {fmt(calcularParcela(imovel.parcelas_cubs, c.valor_cub))}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}

          {aba !== 'analise' && (listaAtual as any[]).length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              {aba === 'normais' && 'Nenhuma parcela registrada.'}
              {aba === 'adiantadas' && 'Nenhuma parcela adiantada.'}
              {aba === 'reforcos' && 'Nenhum reforço registrado.'}
              {aba === 'cub' && 'Nenhum CUB registrado.'}
            </div>
          )}
        </div>
      </div>

      {modalParcela && (
        <ModalParcela
          imovel={imovel}
          cubEfetivoValor={cubEfetivoValor}
          proximaParcela={proximaParcela}
          onFechar={() => setModalParcela(false)}
          onSalvo={() => { setModalParcela(false); carregar() }}
        />
      )}
      {modalReforco && (
        <ModalReforco
          cubAtualValor={cubEfetivoValor}
          cubsPagosEscritura={cubsPagosEscritura}
          onFechar={() => setModalReforco(false)}
          onSalvo={() => { setModalReforco(false); carregar() }}
        />
      )}
      {modalCub && (
        <ModalCub
          onFechar={() => setModalCub(false)}
          onSalvo={() => { setModalCub(false); carregar() }}
        />
      )}
      {modalHistCub && (
        <ModalHistoricoCub
          historico={historicoCub}
          imovel={imovel}
          onFechar={() => setModalHistCub(false)}
          onAtualizar={() => carregar()}
        />
      )}
    </div>
  )
}