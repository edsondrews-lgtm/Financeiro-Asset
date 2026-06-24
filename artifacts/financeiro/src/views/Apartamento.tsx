import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Home, Plus, X, Trash2, Edit2, Check, History,
  TrendingUp, Calendar, RefreshCw, ChevronDown, ChevronUp,
  DollarSign, BarChart3, Clock, AlertTriangle, Zap, Brain, Sparkles,
  Calculator, Target, TrendingDown, Award,
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


// ─── Simulador de Adiantamento — De Trás pra Frente ──────────────────────────

function SimuladorQuitacao({ imovel, parcelas, cubEfetivoValor, totalPago, reforcos }: {
  imovel: Imovel
  parcelas: Parcela[]
  cubEfetivoValor: number
  totalPago: number
  reforcos: Reforco[]
}) {
  const [crescCUB, setCrescCUB] = useState(0.8)
  const [modalParcela, setModalParcela] = useState<LinhaSimulacao | null>(null)

  const DATA_ENTREGA = new Date('2027-12-10T12:00:00')
  const DATA_INICIO  = new Date('2022-12-10T12:00:00')
  const CUBS         = imovel.parcelas_cubs // 0.8582

  const parcelasNormais   = parcelas.filter(p => !p.adiantada)
  const parcelasAdiantadas = parcelas.filter(p => p.adiantada)
  const parcelasJaPagas   = new Set([...parcelasNormais, ...parcelasAdiantadas].map(p => p.numero_parcela))

  // Data de vencimento original de cada parcela
  function dataVencimento(numParcela: number): Date {
    const d = new Date(DATA_INICIO)
    d.setMonth(d.getMonth() + numParcela - 1)
    return d
  }

  // Valor projetado de uma parcela na sua data original de vencimento
  // usando crescimento estimado do CUB + 1% ao mês após entrega
  function valorProjetadoNaData(numParcela: number): number {
    const dataVenc = dataVencimento(numParcela)
    const hoje = new Date()

    // Meses até o vencimento original
    const mesesAteCub = Math.max(0,
      (dataVenc.getFullYear() - hoje.getFullYear()) * 12 +
      (dataVenc.getMonth() - hoje.getMonth())
    )

    // CUB projetado na data de vencimento
    const cubNaData = cubEfetivoValor * Math.pow(1 + crescCUB / 100, mesesAteCub)

    // Parcela base pelo CUB projetado
    const parcelaBase = CUBS * cubNaData

    // Se for após a entrega, aplica +1% ao mês
    if (dataVenc > DATA_ENTREGA) {
      const mesesAposEntrega = Math.max(0,
        (dataVenc.getFullYear() - DATA_ENTREGA.getFullYear()) * 12 +
        (dataVenc.getMonth() - DATA_ENTREGA.getMonth())
      )
      return parseFloat((parcelaBase * Math.pow(1.01, mesesAposEntrega)).toFixed(2))
    }

    return parseFloat(parcelaBase.toFixed(2))
  }

  // Valor se pagar HOJE (CUB atual, sem juros pois ainda não entregou)
  function valorHoje(numParcela: number): number {
    const dataVenc = dataVencimento(numParcela)
    // Se for após entrega, ainda sim paga hoje sem o 1% (adiantando antes da entrega)
    return parseFloat((CUBS * cubEfetivoValor).toFixed(2))
  }

  interface LinhaSimulacao {
    numero: number
    dataVencimento: Date
    jaAdiantada: boolean
    jaPaga: boolean
    valorHoje: number
    valorProjetado: number
    economia: number
    aposEntrega: boolean
    mesesAposEntrega: number
  }

  // Gera todas as parcelas restantes ordenadas de trás pra frente (mais caras primeiro)
  const todasRestantes: LinhaSimulacao[] = []
  for (let n = imovel.total_parcelas; n >= 1; n--) {
    const jaAdiantada = parcelasAdiantadas.some(p => p.numero_parcela === n)
    const jaPagaNorm  = parcelasNormais.some(p => p.numero_parcela === n)
    const dataVenc    = dataVencimento(n)
    const aposEntrega = dataVenc > DATA_ENTREGA
    const mesesAposEntrega = aposEntrega ? Math.max(0,
      (dataVenc.getFullYear() - DATA_ENTREGA.getFullYear()) * 12 +
      (dataVenc.getMonth() - DATA_ENTREGA.getMonth())
    ) : 0
    const vh = valorHoje(n)
    const vp = valorProjetadoNaData(n)

    todasRestantes.push({
      numero: n,
      dataVencimento: dataVenc,
      jaAdiantada,
      jaPaga: jaPagaNorm,
      valorHoje: vh,
      valorProjetado: vp,
      economia: parseFloat(Math.max(0, vp - vh).toFixed(2)),
      aposEntrega,
      mesesAposEntrega,
    })
  }

  const aindaNaoAdiantadas = todasRestantes.filter(p => !p.jaAdiantada && !p.jaPaga)
  const totalEconomiaPotencial = aindaNaoAdiantadas.reduce((s, p) => s + p.economia, 0)
  const totalSeAdiantarTudo = aindaNaoAdiantadas.reduce((s, p) => s + p.valorHoje, 0)

  const fmtMes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Calculator size={16}/></div>
            <div>
              <div className="text-sm font-black text-slate-700">Simulador de Adiantamento — De Trás pra Frente</div>
              <div className="text-xs text-slate-400">Parcelas ordenadas da mais cara pra mais barata · Clique para ver detalhes</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">CUB % /mês:</label>
            <input type="range" min={0} max={2} step={0.1} value={crescCUB}
              onChange={e => setCrescCUB(parseFloat(e.target.value))}
              className="w-24 accent-emerald-600" />
            <span className="text-sm font-black text-emerald-600 w-10">{crescCUB.toFixed(1)}%</span>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Economia potencial total</div>
            <div className="text-xl font-black text-emerald-700">{totalEconomiaPotencial.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            <div className="text-[10px] text-emerald-400">adiantando tudo hoje</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Custo total se adiantar tudo</div>
            <div className="text-xl font-black text-blue-700">{totalSeAdiantarTudo.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            <div className="text-[10px] text-blue-400">{aindaNaoAdiantadas.length} parcelas restantes</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Já adiantadas</div>
            <div className="text-xl font-black text-amber-700">{parcelasAdiantadas.length}</div>
            <div className="text-[10px] text-amber-400">parcelas pagas antecipado</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
            <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Parcelas após entrega</div>
            <div className="text-xl font-black text-rose-700">{todasRestantes.filter(p => p.aposEntrega && !p.jaAdiantada && !p.jaPaga).length}</div>
            <div className="text-[10px] text-rose-400">com +1%/mês acumulado</div>
          </div>
        </div>
      </div>

      {/* Tabela linha por linha */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b-2 border-slate-100">
              <th className="text-left px-4 py-3">Parcela</th>
              <th className="text-left px-3 py-3">Vencimento original</th>
              <th className="text-right px-3 py-3">Valor hoje</th>
              <th className="text-right px-3 py-3">Valor projetado</th>
              <th className="text-right px-3 py-3">Economia</th>
              <th className="text-center px-3 py-3">Status</th>
              <th className="text-center px-3 py-3">Info</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {todasRestantes.map(p => (
              <tr key={p.numero}
                className={`transition-colors ${
                  p.jaAdiantada ? 'bg-amber-50/60' :
                  p.jaPaga ? 'bg-slate-50/60 opacity-50' :
                  p.aposEntrega ? 'hover:bg-rose-50/40' :
                  'hover:bg-emerald-50/40'
                }`}>
                <td className="px-4 py-2.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                    p.jaAdiantada ? 'bg-amber-100 text-amber-700' :
                    p.jaPaga ? 'bg-slate-100 text-slate-400' :
                    p.aposEntrega ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    #{p.numero}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {fmtMes(p.dataVencimento)}
                  {p.aposEntrega && (
                    <span className="ml-1 text-[9px] text-rose-400 font-bold">+{p.mesesAposEntrega}m após entrega</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-slate-700">
                  {p.valorHoje.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-rose-600">
                  {p.valorProjetado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {p.jaPaga || p.jaAdiantada ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span className={`font-black ${p.economia > 200 ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      +{p.economia.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {p.jaAdiantada ? (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold">✓ Adiantada</span>
                  ) : p.jaPaga ? (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[9px] font-bold">✓ Paga</span>
                  ) : p.aposEntrega ? (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[9px] font-bold">Pós-entrega</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[9px] font-bold">Pendente</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {!p.jaPaga && (
                    <button onClick={() => setModalParcela(p)}
                      className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                      <ChevronDown size={12}/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalhe da parcela */}
      {modalParcela && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${modalParcela.jaAdiantada ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  <Calculator size={18}/>
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800">Parcela #{modalParcela.numero}</div>
                  <div className="text-xs text-slate-400">Simulação de adiantamento</div>
                </div>
              </div>
              <button onClick={() => setModalParcela(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16}/></button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vencimento original:</span>
                  <span className="font-bold text-slate-700">{fmtMes(modalParcela.dataVencimento)}</span>
                </div>
                {modalParcela.aposEntrega && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Meses após entrega:</span>
                    <span className="font-bold text-rose-600">{modalParcela.mesesAposEntrega} meses → +{(Math.pow(1.01, modalParcela.mesesAposEntrega) - 1).toFixed(2).replace('.', ',')}% de juros</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">CUB hoje:</span>
                  <span className="font-bold text-slate-700">{cubEfetivoValor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CUB projetado no venc.:</span>
                  <span className="font-bold text-amber-600">
                    {(cubEfetivoValor * Math.pow(1 + crescCUB/100,
                      Math.max(0,
                        (modalParcela.dataVencimento.getFullYear() - new Date().getFullYear()) * 12 +
                        (modalParcela.dataVencimento.getMonth() - new Date().getMonth())
                      )
                    )).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Se pagar HOJE</div>
                  <div className="text-xl font-black text-emerald-700">
                    {modalParcela.valorHoje.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                  </div>
                  <div className="text-[10px] text-emerald-400">CUB atual × {CUBS} CUBs</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider">No vencimento original</div>
                  <div className="text-xl font-black text-rose-700">
                    {modalParcela.valorProjetado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                  </div>
                  <div className="text-[10px] text-rose-400">
                    CUB projetado{modalParcela.aposEntrega ? ` + ${modalParcela.mesesAposEntrega}x1%` : ''}
                  </div>
                </div>
              </div>

              {!modalParcela.jaAdiantada && (
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-4 text-white text-center">
                  <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider mb-1">💰 Economia adiantando hoje</div>
                  <div className="text-3xl font-black">
                    {modalParcela.economia.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                  </div>
                  <div className="text-xs text-emerald-200 mt-1">
                    {modalParcela.aposEntrega
                      ? `Evita CUB maior + ${modalParcela.mesesAposEntrega} meses de juros de 1%/mês`
                      : `Evita a correção do CUB pelos próximos meses`}
                  </div>
                </div>
              )}

              {modalParcela.jaAdiantada && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-sm font-black text-amber-700">✓ Esta parcela já foi adiantada!</div>
                  <div className="text-xs text-amber-500 mt-1">Confira a aba "Parcelas Adiantadas" para ver a economia real gerada.</div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setModalParcela(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Projeção CUB até Entrega ──────────────────────────────────────────────────

function ProjecaoCUB({ historicoCub, imovel, parcelas, cubEfetivoValor, valorAtualizado, cubsRestantesEscritura }: {
  historicoCub: CubRegistro[]
  imovel: Imovel
  parcelas: Parcela[]
  cubEfetivoValor: number
  valorAtualizado: number
  cubsRestantesEscritura: number
}) {
  // Calcula média de crescimento mensal do CUB com base no histórico
  const sorted = [...historicoCub].sort((a,b) => a.data_registro.localeCompare(b.data_registro))
  const crescimentos = sorted.slice(1).map((c, i) => {
    const anterior = sorted[i].valor_cub
    return (c.valor_cub - anterior) / anterior * 100
  }).filter(v => v > 0)
  const mediaCrescimento = crescimentos.length > 0
    ? crescimentos.reduce((s,v) => s+v, 0) / crescimentos.length
    : 0.8

  const mesesEntrega = Math.max(0,
    (new Date(imovel.data_entrega_chaves).getFullYear() - new Date().getFullYear()) * 12 +
    (new Date(imovel.data_entrega_chaves).getMonth() - new Date().getMonth())
  )

  const parcelasNormais = parcelas.filter(p => !p.adiantada)
  const parcelasAdiantadas = parcelas.filter(p => p.adiantada)
  const parcelasRestantes = imovel.total_parcelas - parcelasNormais.length - parcelasAdiantadas.length

  // Projeta CUB mês a mês
  const projecao: { mes: number; cubProjetado: number; parcela: number }[] = []
  let cubProj = cubEfetivoValor
  for (let i = 1; i <= mesesEntrega; i++) {
    cubProj = cubProj * (1 + mediaCrescimento / 100)
    projecao.push({
      mes: i,
      cubProjetado: cubProj,
      parcela: imovel.parcelas_cubs * cubProj,
    })
  }

  const cubNaEntrega = projecao[projecao.length - 1]?.cubProjetado ?? cubEfetivoValor
  const escrituraNaEntrega = cubsRestantesEscritura * cubNaEntrega
  const parcelasRestFuturas = Math.min(parcelasRestantes, mesesEntrega)
  const totalParcelasFuturas = projecao.slice(0, parcelasRestFuturas).reduce((s,p) => s+p.parcela, 0)
  const totalFinalEstimado = totalParcelasFuturas + escrituraNaEntrega
  const totalCubs = imovel.valor_original / imovel.cub_referencia_original
  const valorImovNaEntrega = totalCubs * cubNaEntrega

  // SVG mini gráfico
  const W = 500, H = 120, PAD = { top: 10, right: 10, bottom: 25, left: 55 }
  const maxCub = Math.max(...projecao.map(p => p.cubProjetado))
  const minCub = cubEfetivoValor * 0.99
  const xS = (i: number) => PAD.left + (i / Math.max(projecao.length - 1, 1)) * (W - PAD.left - PAD.right)
  const yS = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - minCub) / (maxCub - minCub))
  const pathProj = projecao.map((p, i) => `${i===0?'M':'L'} ${xS(i)} ${yS(p.cubProjetado)}`).join(' ')
  const labelsX = projecao.filter((_, i) => i % Math.ceil(projecao.length/5) === 0 || i === projecao.length-1)

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-50 flex items-center gap-2">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><TrendingUp size={16}/></div>
        <div>
          <div className="text-sm font-black text-slate-700">Projeção do CUB até Dezembro/2027</div>
          <div className="text-xs text-slate-400">Baseada na média histórica de +{mediaCrescimento.toFixed(2)}%/mês dos seus {sorted.length} registros</div>
        </div>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center space-y-0.5">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">CUB Hoje</div>
            <div className="text-lg font-black text-amber-700">{cubEfetivoValor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center space-y-0.5">
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-wider">CUB na Entrega</div>
            <div className="text-lg font-black text-orange-700">{cubNaEntrega.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            <div className="text-[10px] text-orange-400">em {mesesEntrega} meses</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center space-y-0.5">
            <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Escritura estimada</div>
            <div className="text-lg font-black text-rose-700">{escrituraNaEntrega.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            <div className="text-[10px] text-rose-400">{cubsRestantesEscritura.toFixed(4)} CUBs</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center space-y-0.5">
            <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider">Imóvel valerá</div>
            <div className="text-lg font-black text-purple-700">{valorImovNaEntrega.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            <div className="text-[10px] text-purple-400">pelo CUB projetado</div>
          </div>
        </div>

        {/* Mini gráfico da projeção */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{maxHeight:130}}>
          <defs>
            <linearGradient id="gradProj" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b"/>
              <stop offset="100%" stopColor="#ef4444"/>
            </linearGradient>
          </defs>
          {[0,50,100].map(pct => {
            const v = minCub + (maxCub - minCub) * (pct/100)
            return (
              <g key={pct}>
                <line x1={PAD.left} y1={yS(v)} x2={W-PAD.right} y2={yS(v)} stroke="#f8fafc" strokeWidth="1"/>
                <text x={PAD.left-4} y={yS(v)+3} textAnchor="end" fontSize="8" fill="#94a3b8">{v.toFixed(0)}</text>
              </g>
            )
          })}
          <path d={pathProj} fill="none" stroke="url(#gradProj)" strokeWidth="2.5"/>
          {labelsX.map((p,i) => (
            <text key={i} x={xS(p.mes-1)} y={H-5} textAnchor="middle" fontSize="8" fill="#94a3b8">
              +{p.mes}m
            </text>
          ))}
          <circle cx={xS(projecao.length-1)} cy={yS(projecao[projecao.length-1]?.cubProjetado??0)} r="4" fill="#ef4444"/>
        </svg>

        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400"/>
          Projeção baseada na média histórica de crescimento do CUB dos seus registros. O CUB real pode variar.
          Para preparar a reserva da escritura, considere um valor entre {(escrituraNaEntrega * 0.9).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} e {(escrituraNaEntrega * 1.1).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.
        </div>
      </div>
    </div>
  )
}

// ─── Histórico de Economia Acumulada ──────────────────────────────────────────

function HistoricoEconomia({ parcelas, cubEfetivoValor, imovel }: {
  parcelas: Parcela[]
  cubEfetivoValor: number
  imovel: Imovel
}) {
  const adiantadas = [...parcelas.filter(p => p.adiantada)]
    .sort((a,b) => a.data_pagamento.localeCompare(b.data_pagamento))

  if (adiantadas.length === 0) return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Award size={16}/></div>
        <div className="text-sm font-black text-slate-700">Histórico de Economia Acumulada</div>
      </div>
      <div className="text-center py-6 text-slate-400 text-xs">Nenhuma parcela adiantada registrada ainda.</div>
    </div>
  )

  const parcelaHoje = calcularParcela(imovel.parcelas_cubs, cubEfetivoValor)

  // Acumula economia por data
  let acumulado = 0
  const dados = adiantadas.map(p => {
    const economia = Math.max(0, parcelaHoje - p.valor_pago)
    acumulado += economia
    return {
      data: p.data_pagamento,
      parcela: p.numero_parcela,
      pago: p.valor_pago,
      economia,
      acumulado,
    }
  })

  const totalEconomia = acumulado
  const maiorEconomia = Math.max(...dados.map(d => d.economia))

  // SVG barras
  const W = 500, H = 120, PAD = { top: 10, right: 10, bottom: 30, left: 10 }
  const barW = Math.min(30, (W - PAD.left - PAD.right) / dados.length - 4)
  const barGap = (W - PAD.left - PAD.right) / dados.length
  const yS = (v: number) => H - PAD.bottom - (v / maiorEconomia) * (H - PAD.top - PAD.bottom)

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Award size={16}/></div>
          <div>
            <div className="text-sm font-black text-slate-700">Histórico de Economia Acumulada</div>
            <div className="text-xs text-slate-400">Economia real gerada por cada parcela adiantada</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Total economizado</div>
          <div className="text-xl font-black text-emerald-600">{totalEconomia.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {/* Gráfico de barras */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{maxHeight:130}}>
          {dados.map((d, i) => {
            const x = PAD.left + i * barGap + barGap/2 - barW/2
            const y = yS(d.economia)
            const barH = H - PAD.bottom - y
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={barH}
                  fill="#10b981" rx="3" opacity="0.85"/>
                <text x={x + barW/2} y={H - PAD.bottom + 10} textAnchor="middle" fontSize="8" fill="#94a3b8">
                  #{d.parcela}
                </text>
                <text x={x + barW/2} y={y - 3} textAnchor="middle" fontSize="7" fill="#10b981" fontWeight="bold">
                  {d.economia.toFixed(0)}
                </text>
              </g>
            )
          })}
          {/* Linha acumulado */}
          {dados.map((d, i) => {
            const x = PAD.left + i * barGap + barGap/2
            const y = H - PAD.bottom - (d.acumulado / totalEconomia) * (H - PAD.top - PAD.bottom) * 0.7
            return i === 0
              ? <circle key={`dot${i}`} cx={x} cy={y} r="3" fill="#6366f1"/>
              : <line key={`line${i}`}
                  x1={PAD.left + (i-1) * barGap + barGap/2}
                  y1={H - PAD.bottom - (dados[i-1].acumulado / totalEconomia) * (H - PAD.top - PAD.bottom) * 0.7}
                  x2={x} y2={y}
                  stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,2"/>
          })}
        </svg>

        {/* Tabela resumo */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="text-left py-2 pr-3">Parcela</th>
                <th className="text-left py-2 pr-3">Data</th>
                <th className="text-right py-2 pr-3">Pago</th>
                <th className="text-right py-2 pr-3">Valor hoje</th>
                <th className="text-right py-2 pr-3">Economia</th>
                <th className="text-right py-2">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dados.map(d => (
                <tr key={d.parcela} className="hover:bg-slate-50/60">
                  <td className="py-2 pr-3 font-bold text-amber-600">#{d.parcela}</td>
                  <td className="py-2 pr-3 text-slate-400">{new Date(d.data+'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="py-2 pr-3 text-right text-slate-600">{d.pago.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{parcelaHoje.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="py-2 pr-3 text-right font-bold text-emerald-600">+{d.economia.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="py-2 text-right font-black text-indigo-600">{d.acumulado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Comparativo Real vs Financiamento ────────────────────────────────────────

function ComparativoReal({ imovel, totalPago, parcelas, reforcos, taxaAnual, taxaSelecionada, valorAtualizado }: {
  imovel: Imovel
  totalPago: number
  parcelas: Parcela[]
  reforcos: Reforco[]
  taxaAnual: number
  taxaSelecionada: { label: string; taxa: number }
  valorAtualizado: number
}) {
  // Simula financiamento bancário real: SAC ou Price
  const [sistema, setSistema] = useState<'SAC' | 'PRICE'>('SAC')
  const valorFinanciado = imovel.valor_original
  const nParcelas = imovel.total_parcelas // 100 meses
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1/12) - 1

  // Sistema SAC
  const amortizacaoSAC = valorFinanciado / nParcelas
  let saldoSAC = valorFinanciado
  let totalPagoSAC = 0
  let totalJurosSAC = 0
  const parcelasSAC: number[] = []
  for (let i = 0; i < nParcelas; i++) {
    const juros = saldoSAC * taxaMensal
    const parcela = amortizacaoSAC + juros
    parcelasSAC.push(parcela)
    totalPagoSAC += parcela
    totalJurosSAC += juros
    saldoSAC -= amortizacaoSAC
  }
  const primeiraSAC = parcelasSAC[0] ?? 0
  const ultimaSAC = parcelasSAC[nParcelas - 1] ?? 0

  // Sistema Price
  const parcelaPrice = taxaMensal > 0
    ? valorFinanciado * (taxaMensal * Math.pow(1+taxaMensal, nParcelas)) / (Math.pow(1+taxaMensal, nParcelas) - 1)
    : valorFinanciado / nParcelas
  const totalPagoPrice = parcelaPrice * nParcelas
  const totalJurosPrice = totalPagoPrice - valorFinanciado

  // Custo total real do CUB (o que você pagou + vai pagar)
  const totalCubsOriginal = imovel.valor_original / imovel.cub_referencia_original
  const totalCubCusto = valorAtualizado // valor atualizado pelo CUB = custo total

  // Economia real
  const economiaSAC = totalPagoSAC - totalCubCusto
  const economiaPrice = totalPagoPrice - totalCubCusto

  const fmt2 = (v: number) => v.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><TrendingDown size={16}/></div>
          <div>
            <div className="text-sm font-black text-slate-700">Comparativo Real: CUB vs Financiamento Bancário</div>
            <div className="text-xs text-slate-400">Quanto custaria o mesmo imóvel financiado pelo banco — {taxaSelecionada.label} · {taxaAnual.toFixed(2)}% a.a.</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(['SAC','PRICE'] as const).map(s => (
            <button key={s} onClick={() => setSistema(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${sistema===s ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CUB */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-black text-indigo-500 uppercase tracking-wider">✓ Seu contrato (CUB)</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Valor original:</span>
                <span className="font-bold text-slate-700">{fmt2(imovel.valor_original)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Correção total (CUB):</span>
                <span className="font-bold text-amber-600">+{fmt2(valorAtualizado - imovel.valor_original)}</span>
              </div>
              <div className="flex justify-between border-t border-indigo-200 pt-1.5">
                <span className="font-bold text-slate-700">Total estimado:</span>
                <span className="font-black text-indigo-700">{fmt2(totalCubCusto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Parcela atual:</span>
                <span className="font-bold text-indigo-600">{fmt2(calcularParcela(imovel.parcelas_cubs, 3096.25))}</span>
              </div>
            </div>
          </div>

          {/* Financiamento SAC/Price */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-black text-rose-500 uppercase tracking-wider">✗ Financiamento {sistema}</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Valor financiado:</span>
                <span className="font-bold text-slate-700">{fmt2(valorFinanciado)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total de juros:</span>
                <span className="font-bold text-rose-600">+{fmt2(sistema==='SAC' ? totalJurosSAC : totalJurosPrice)}</span>
              </div>
              <div className="flex justify-between border-t border-rose-200 pt-1.5">
                <span className="font-bold text-slate-700">Total pago:</span>
                <span className="font-black text-rose-700">{fmt2(sistema==='SAC' ? totalPagoSAC : totalPagoPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">1ª parcela:</span>
                <span className="font-bold text-rose-600">{fmt2(sistema==='SAC' ? primeiraSAC : parcelaPrice)}</span>
              </div>
              {sistema==='SAC' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Última parcela:</span>
                  <span className="font-bold text-rose-400">{fmt2(ultimaSAC)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Economia */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-black text-emerald-500 uppercase tracking-wider">💰 Você economizou</div>
            <div className="text-3xl font-black text-emerald-700">
              {fmt2(sistema==='SAC' ? economiaSAC : economiaPrice)}
            </div>
            <div className="text-xs text-emerald-500">
              vs financiamento {sistema} · {taxaAnual.toFixed(2)}% a.a.
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">
              = {((sistema==='SAC' ? economiaSAC : economiaPrice) / imovel.valor_original * 100).toFixed(1)}% do valor original do imóvel
            </div>
            <div className="mt-2 p-2 bg-emerald-100 rounded-lg text-[10px] text-emerald-700 font-bold">
              Comprando via construtora com CUB, você evitou pagar {fmt2(sistema==='SAC' ? totalJurosSAC : totalJurosPrice)} só em juros bancários.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ─── Aba Simulador de Adiantamento ───────────────────────────────────────────

function AbaSimulador({ imovel, parcelas, cubEfetivoValor, reforcos }: {
  imovel: Imovel
  parcelas: Parcela[]
  cubEfetivoValor: number
  reforcos: Reforco[]
}) {
  const [crescCUB, setCrescCUB] = useState(0.8)
  const [modalDetalhe, setModalDetalhe] = useState<LinhaSimul | null>(null)
  const [filtroSimul, setFiltroSimul] = useState<'todas' | 'adiantada' | 'pos-entrega'>('todas')

  const DATA_ENTREGA = new Date('2027-12-10T12:00:00')
  const DATA_INICIO  = new Date('2022-12-10T12:00:00')
  const CUBS         = imovel.parcelas_cubs

  const parcelasNormais    = parcelas.filter(p => !p.adiantada)
  const parcelasAdiantadas = parcelas.filter(p => p.adiantada)

  function dataVencimento(n: number): Date {
    const d = new Date(DATA_INICIO)
    d.setMonth(d.getMonth() + n - 1)
    return d
  }

  function valorProjetadoNaData(n: number): number {
    const dataVenc = dataVencimento(n)
    const hoje = new Date()
    const mesesAteCub = Math.max(0,
      (dataVenc.getFullYear() - hoje.getFullYear()) * 12 +
      (dataVenc.getMonth() - hoje.getMonth())
    )
    const cubNaData = cubEfetivoValor * Math.pow(1 + crescCUB / 100, mesesAteCub)
    const parcelaBase = CUBS * cubNaData
    if (dataVenc > DATA_ENTREGA) {
      const mAfEntrega = Math.max(0,
        (dataVenc.getFullYear() - DATA_ENTREGA.getFullYear()) * 12 +
        (dataVenc.getMonth() - DATA_ENTREGA.getMonth())
      )
      return parseFloat((parcelaBase * Math.pow(1.01, mAfEntrega)).toFixed(2))
    }
    return parseFloat(parcelaBase.toFixed(2))
  }

  interface LinhaSimul {
    numero: number
    dataVenc: Date
    jaPaga: boolean
    jaAdiantada: boolean
    valorPagoReal: number | null   // valor que realmente saiu do bolso
    valorHoje: number              // CUB atual × CUBS (se adiantar hoje)
    valorProjetado: number         // valor projetado no vencimento original
    economiaSePagoHoje: number     // projetado - hoje (para pendentes)
    economiaJaObtida: number       // projetado - pago real (para adiantadas)
    aposEntrega: boolean
    mAfEntrega: number
  }

  const linhas: LinhaSimul[] = []
  for (let n = imovel.total_parcelas; n >= 1; n--) {
    const adiantada = parcelasAdiantadas.find(p => p.numero_parcela === n)
    const normal    = parcelasNormais.find(p => p.numero_parcela === n)
    const dataVenc  = dataVencimento(n)
    const aposEntrega = dataVenc > DATA_ENTREGA
    const mAfEntrega = aposEntrega ? Math.max(0,
      (dataVenc.getFullYear() - DATA_ENTREGA.getFullYear()) * 12 +
      (dataVenc.getMonth() - DATA_ENTREGA.getMonth())
    ) : 0
    const vHoje     = parseFloat((CUBS * cubEfetivoValor).toFixed(2))
    const vProj     = valorProjetadoNaData(n)
    const vPagoReal = adiantada?.valor_pago ?? normal?.valor_pago ?? null

    linhas.push({
      numero: n,
      dataVenc,
      jaPaga: !!normal,
      jaAdiantada: !!adiantada,
      valorPagoReal: vPagoReal,
      valorHoje: vHoje,
      valorProjetado: vProj,
      economiaSePagoHoje: parseFloat(Math.max(0, vProj - vHoje).toFixed(2)),
      economiaJaObtida: adiantada
        ? parseFloat(Math.max(0, vProj - adiantada.valor_pago).toFixed(2))
        : 0,
      aposEntrega,
      mAfEntrega,
    })
  }

  const pendentes   = linhas.filter(l => !l.jaPaga && !l.jaAdiantada)
  const adiantadas  = linhas.filter(l => l.jaAdiantada)
  const normaisPagas = linhas.filter(l => l.jaPaga)

  const totalEconomiaPotencial = pendentes.reduce((s, l) => s + l.economiaSePagoHoje, 0)
  const totalEconomiaJaObtida  = adiantadas.reduce((s, l) => s + l.economiaJaObtida, 0)
  const totalSeAdiantarTudo    = pendentes.reduce((s, l) => s + l.valorHoje, 0)

  const fmt2 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtMes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })

  return (
    <div className="p-6 space-y-5">

      {/* Controle CUB */}
      <div className="rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap" style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><Calculator size={15}/></div>
          <div>
            <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Simulador de Adiantamento — De Trás pra Frente</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Parcelas das mais caras (pós-entrega) para as mais baratas</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2 ml-auto" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <label className="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>CUB % /mês:</label>
          <input type="range" min={0} max={2} step={0.1} value={crescCUB}
            onChange={e => setCrescCUB(parseFloat(e.target.value))}
            className="w-24 accent-emerald-600" />
          <span className="text-sm font-black text-emerald-600 w-10">{crescCUB.toFixed(1)}%</span>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Parcelas adiantadas', value: adiantadas.length.toString(), cor: '#3B6D11' },
          { label: 'Total já economizado', value: fmt2(totalEconomiaJaObtida), cor: '#BA7517' },
          { label: 'Parcelas restantes', value: pendentes.length.toString(), cor: '#993C1D' },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4 space-y-1 border" style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {card.label}
            </div>
            <div className="text-2xl font-black" style={{ color: card.cor }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { key: 'todas', label: `Todas (${linhas.length})` },
          { key: 'adiantada', label: `✓ Adiantadas (${adiantadas.length})` },
          { key: 'pos-entrega', label: `Pós-entrega (${pendentes.filter(l => l.aposEntrega).length})` },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFiltroSimul(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              filtroSimul === f.key ? 'text-white' : 'text-slate-500 hover:bg-slate-200'
            }`} style={{
              backgroundColor: filtroSimul === f.key ? 'var(--accent)' : 'var(--bg-tertiary)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela completa */}
      <div className="rounded-2xl border overflow-hidden" style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
      }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <tr className="text-[10px] font-bold uppercase tracking-wider" style={{
                color: 'var(--text-muted)',
                borderBottom: '2px solid var(--border-color)',
              }}>
                <th className="text-left px-4 py-3" style={{ width: 48 }}>#</th>
                <th className="text-left px-3 py-3">mês</th>
                <th className="text-left px-3 py-3">status</th>
                <th className="text-right px-3 py-3">valor da parcela</th>
                <th className="text-right px-3 py-3">total com juros</th>
                <th className="text-right px-3 py-3" style={{ minWidth: 110 }}>economia</th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'var(--border-color)' }}>
              {linhas.filter(l => {
                if (filtroSimul === 'todas') return true
                if (filtroSimul === 'adiantada') return l.jaAdiantada
                if (filtroSimul === 'pos-entrega') return l.aposEntrega && !l.jaPaga && !l.jaAdiantada
                return true
              }).map(l => {
                const status = l.jaAdiantada ? 'adiantada' : (l.aposEntrega && !l.jaPaga ? 'pos-entrega' : 'normal')
                return (
                <tr key={l.numero} data-status={status}
                  className="transition-colors hover:bg-slate-50/50"
                  style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {/* # + badge circular */}
                  <td className="px-4 py-3">
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 11, lineHeight: 1,
                      color: status === 'adiantada' ? '#3B6D11'
                        : status === 'pos-entrega' ? '#993C1D'
                        : 'var(--text-muted)',
                      backgroundColor: status === 'adiantada' ? '#E6F0DA'
                        : status === 'pos-entrega' ? '#F5E0D9'
                        : 'var(--bg-tertiary)',
                    }}>
                      {l.numero}
                    </div>
                  </td>

                  {/* mês + info */}
                  <td className="px-3 py-3 align-top">
                    <div>
                      <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {fmtMes(l.dataVenc)}
                      </div>
                      {l.aposEntrega && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          +{l.mAfEntrega}m pós-entrega
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 align-top">
                    {l.jaAdiantada ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{
                        backgroundColor: '#E6F0DA',
                        color: '#3B6D11',
                      }}>✓ Adiantada</span>
                    ) : l.jaPaga ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                      }}>✓ Paga</span>
                    ) : l.aposEntrega ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{
                        backgroundColor: '#F5E0D9',
                        color: '#993C1D',
                      }}>Pós-entrega</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                      }}>Pendente</span>
                    )}
                  </td>

                  {/* Valor da parcela */}
                  <td className="px-3 py-3 text-right">
                    {l.jaAdiantada && l.valorPagoReal !== null ? (
                      <div>
                        <div className="font-medium text-sm" style={{ color: '#3B6D11' }}>
                          {fmt2(l.valorPagoReal)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>pago adiantado</div>
                      </div>
                    ) : l.jaPaga && l.valorPagoReal !== null ? (
                      <div className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {fmt2(l.valorPagoReal)}
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {fmt2(l.valorHoje)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>se pagar hoje</div>
                      </div>
                    )}
                  </td>

                  {/* Total com juros */}
                  <td className="px-3 py-3 text-right">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>
                      {fmt2(l.valorProjetado)}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>no vencimento</div>
                  </td>

                  {/* Economia */}
                  <td className="px-3 py-3 text-right" style={{ minWidth: 110 }}>
                    {l.jaAdiantada ? (
                      <div>
                        <div className="font-medium text-sm" style={{ color: '#3B6D11' }}>
                          +{fmt2(l.economiaJaObtida)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>já economizado ✓</div>
                      </div>
                    ) : l.jaPaga ? (
                      <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                    ) : (
                      <div>
                        <div className="font-medium text-sm" style={{
                          color: l.aposEntrega ? '#BA7517' : '#3B6D11',
                        }}>
                          +{fmt2(l.economiaSePagoHoje)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>se adiantar hoje</div>
                      </div>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
            {/* Totais */}
            <tfoot className="sticky bottom-0" style={{
              borderTop: '2px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
            }}>
              <tr>
                <td colSpan={3} className="px-4 py-3 text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Resumo
                </td>
                <td className="px-3 py-3 text-right text-xs font-black" style={{ color: 'var(--text-secondary)' }}>
                  {fmt2(totalSeAdiantarTudo + adiantadas.reduce((s,l) => s + (l.valorPagoReal ?? 0), 0))}
                </td>
                <td className="px-3 py-3 text-right text-xs font-black" style={{ color: '#993C1D' }}>
                  {fmt2(pendentes.reduce((s,l) => s + l.valorProjetado, 0) + adiantadas.reduce((s,l) => s + l.valorProjetado, 0))}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="text-xs font-black" style={{ color: '#BA7517' }}>
                    +{fmt2(totalEconomiaJaObtida + totalEconomiaPotencial)}
                  </div>
                  <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>total (já obtida + potencial)</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal detalhe */}
      {modalDetalhe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4" style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{
                  backgroundColor: modalDetalhe.jaAdiantada ? '#F5E0D9' : 'var(--bg-tertiary)',
                  color: modalDetalhe.jaAdiantada ? '#993C1D' : 'var(--text-secondary)',
                }}>
                  <Calculator size={18}/>
                </div>
                <div>
                  <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Parcela #{modalDetalhe.numero}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {modalDetalhe.jaAdiantada ? 'Já adiantada ✓' : modalDetalhe.jaPaga ? 'Já paga ✓' : 'Simulação de adiantamento'}
                  </div>
                </div>
              </div>
              <button onClick={() => setModalDetalhe(null)}
                className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={16}/></button>
            </div>

            <div className="p-4 rounded-xl space-y-2 text-xs" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Vencimento original:</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmtMes(modalDetalhe.dataVenc)}</span>
              </div>
              {modalDetalhe.aposEntrega && (
                <>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Meses após entrega:</span>
                    <span className="font-bold" style={{ color: '#993C1D' }}>{modalDetalhe.mAfEntrega} meses</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Juros acumulados (1%/mês):</span>
                    <span className="font-bold" style={{ color: '#993C1D' }}>
                      +{((Math.pow(1.01, modalDetalhe.mAfEntrega) - 1) * 100).toFixed(2)}%
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>CUB atual:</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt2(cubEfetivoValor)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Crescimento CUB estimado:</span>
                <span className="font-bold" style={{ color: '#BA7517' }}>{crescCUB.toFixed(1)}% /mês</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {modalDetalhe.jaAdiantada ? (
                <>
                  <div className="rounded-xl p-3 text-center border" style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-color)',
                  }}>
                    <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#BA7517' }}>Valor pago</div>
                    <div className="text-xl font-black" style={{ color: '#3B6D11' }}>{fmt2(modalDetalhe.valorPagoReal ?? 0)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>valor real do bolso</div>
                  </div>
                  <div className="rounded-xl p-3 text-center border" style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-color)',
                  }}>
                    <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#993C1D' }}>Custaria no vencimento</div>
                    <div className="text-xl font-black" style={{ color: '#993C1D' }}>{fmt2(modalDetalhe.valorProjetado)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>CUB projetado{modalDetalhe.aposEntrega ? ' + juros' : ''}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl p-3 text-center border" style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-color)',
                  }}>
                    <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#3B6D11' }}>Se pagar hoje</div>
                    <div className="text-xl font-black" style={{ color: '#3B6D11' }}>{fmt2(modalDetalhe.valorHoje)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>CUB atual × {CUBS} CUBs</div>
                  </div>
                  <div className="rounded-xl p-3 text-center border" style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-color)',
                  }}>
                    <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#993C1D' }}>No vencimento original</div>
                    <div className="text-xl font-black" style={{ color: '#993C1D' }}>{fmt2(modalDetalhe.valorProjetado)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>CUB projetado{modalDetalhe.aposEntrega ? ' + juros' : ''}</div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl p-4 text-white text-center" style={{
              background: modalDetalhe.jaAdiantada
                ? 'linear-gradient(135deg, #BA7517, #EF9F27)'
                : 'linear-gradient(135deg, #3B6D11, #97C459)',
            }}>
              <div className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">
                {modalDetalhe.jaAdiantada ? '✓ Economia já obtida' : 'Economia se adiantar hoje'}
              </div>
              <div className="text-3xl font-black">
                {fmt2(modalDetalhe.jaAdiantada ? modalDetalhe.economiaJaObtida : modalDetalhe.economiaSePagoHoje)}
              </div>
              {modalDetalhe.aposEntrega && !modalDetalhe.jaAdiantada && (
                <div className="text-xs text-white/70 mt-1">
                  Inclui economia de CUB + {((Math.pow(1.01, modalDetalhe.mAfEntrega) - 1) * 100).toFixed(1)}% de juros evitados
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setModalDetalhe(null)}
                className="px-5 py-2 text-white rounded-xl text-xs font-bold" style={{
                  backgroundColor: 'var(--text-primary)',
                }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
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

      {/* ── Projeção CUB até entrega ── */}
      <ProjecaoCUB
        historicoCub={historicoCub}
        imovel={imovel}
        parcelas={parcelas}
        cubEfetivoValor={cubEfetivoValor}
        valorAtualizado={valorAtualizado}
        cubsRestantesEscritura={29.6215 - reforcos.filter((r:any)=>r.is_escritura).reduce((s:number,r:any)=>s+(Number(r.cubs_pagos)||0),0)}
      />

      {/* ── Histórico de Economia Acumulada ── */}
      <HistoricoEconomia
        parcelas={parcelas}
        cubEfetivoValor={cubEfetivoValor}
        imovel={imovel}
      />

      {/* ── Comparativo Real vs Financiamento ── */}
      <ComparativoReal
        imovel={imovel}
        totalPago={totalPago}
        parcelas={parcelas}
        reforcos={reforcos}
        taxaAnual={taxaAnual}
        taxaSelecionada={taxaSelecionada}
        valorAtualizado={valorAtualizado}
      />

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

  const [aba, setAba] = useState<'normais' | 'adiantadas' | 'reforcos' | 'cub' | 'analise' | 'simulador'>('normais')
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
              { key: 'simulador', label: '📊 Simulador de Adiantamento' },
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
          {aba === 'simulador' && (
            <AbaSimulador
              imovel={imovel}
              parcelas={parcelas}
              cubEfetivoValor={cubEfetivoValor}
              reforcos={reforcos}
            />
          )}

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