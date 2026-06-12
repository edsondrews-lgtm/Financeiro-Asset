import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  PiggyBank, Plus, X, Edit2, Trash2, History,
  Target, TrendingUp, Calendar, Check, AlertTriangle,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Caixinha {
  id: string
  nome: string
  valor_atual: number
  meta: number | null
  prazo: string | null
  descricao: string | null
  taxa_rendimento_mensal: number
  created_at: string
}

interface Aporte {
  id: string
  caixinha_id: string
  valor_adicionado: number
  valor_anterior: number
  valor_apos: number
  data_aporte: string
  observacao: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

function diasAte(prazo: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(prazo + 'T12:00:00')
  return Math.max(0, Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000))
}

/**
 * Calcula o rendimento ACUMULADO real de cada aporte desde a data do depósito até hoje.
 * Usa juros compostos: valor × ((1 + taxa/100) ^ meses - 1)
 * onde meses = dias decorridos / 30.437
 */
function calcularRendimentoAcumulado(aportes: Aporte[], taxaMensal: number): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return aportes.reduce((total, a) => {
    const dataDeposito = new Date(a.data_aporte + 'T12:00:00')
    const dias = Math.max(0, (hoje.getTime() - dataDeposito.getTime()) / 86400000)
    const meses = dias / 30.437
    const taxa = taxaMensal / 100
    // Juros compostos sobre o valor adicionado naquele aporte
    const juros = Math.abs(a.valor_adicionado) * (Math.pow(1 + taxa, meses) - 1)
    // Só contabiliza aportes positivos (entradas)
    return total + (a.valor_adicionado > 0 ? juros : 0)
  }, 0)
}

// ─── Modal: Aporte ────────────────────────────────────────────────────────────

function ModalAporte({ caixinha, onFechar, onConfirmar }: {
  caixinha: Caixinha
  onFechar: () => void
  onConfirmar: (valor: number, data: string, obs: string) => Promise<void>
}) {
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor)
    if (isNaN(v) || v === 0) return
    setSalvando(true)
    await onConfirmar(v, data, obs)
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Plus size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Adicionar Valor</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="text-xs text-slate-500">
          Meta: <strong className="text-slate-700">{caixinha.nome}</strong>
        </div>

        <form onSubmit={confirmar} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor a Adicionar *</label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-400">
              <span className="px-3 text-slate-400 text-sm font-bold bg-slate-50 py-2.5 border-r border-slate-200">R$</span>
              <input type="number" value={valor} onChange={e => setValor(e.target.value)}
                step="0.01" placeholder="0,00" required autoFocus
                className="flex-1 px-3 py-2.5 text-sm text-slate-700 focus:outline-none" />
            </div>
            {parseFloat(valor) !== 0 && !isNaN(parseFloat(valor)) && (
              <p className={`text-xs mt-1 font-medium ${parseFloat(valor) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                Novo saldo: {fmt(caixinha.valor_atual + parseFloat(valor))}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observação</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ex: Bônus recebido..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 resize-none" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              <Check size={13} /> {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Histórico ─────────────────────────────────────────────────────────

function ModalHistorico({ caixinha, onFechar }: { caixinha: Caixinha; onFechar: () => void }) {
  const [aportes, setAportes] = useState<Aporte[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.from('caixinhas_aportes').select('*')
      .eq('caixinha_id', caixinha.id)
      .order('data_aporte', { ascending: false })
      .then(({ data }) => { setAportes(data || []); setCarregando(false) })
  }, [caixinha.id])

  async function removerAporte(id: string) {
    if (!confirm('Remover este registro?')) return
    await supabase.from('caixinhas_aportes').delete().eq('id', id)
    setAportes(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><History size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Histórico — {caixinha.nome}</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Valor Atual</div>
            <div className="text-lg font-black text-emerald-600 mt-0.5">{fmt(caixinha.valor_atual)}</div>
          </div>
          {caixinha.meta && (
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Meta Total</div>
              <div className="text-lg font-black text-blue-600 mt-0.5">{fmt(caixinha.meta)}</div>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {carregando ? (
            <div className="text-center py-8 text-slate-400 text-sm">Carregando...</div>
          ) : aportes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Nenhum aporte registrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left py-2 pr-4">Data</th>
                  <th className="text-right py-2 pr-4">Valor Adicionado</th>
                  <th className="text-right py-2 pr-4">Valor Anterior</th>
                  <th className="text-right py-2 pr-4">Valor Após</th>
                  <th className="text-left py-2 pr-4">Observação</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {aportes.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="py-3 pr-4 text-slate-500 text-xs">{fmtDate(a.data_aporte)}</td>
                    <td className={`py-3 pr-4 text-right font-bold text-xs ${a.valor_adicionado >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {a.valor_adicionado >= 0 ? '+' : ''}{fmt(a.valor_adicionado)}
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-500 text-xs">{fmt(a.valor_anterior)}</td>
                    <td className="py-3 pr-4 text-right font-bold text-slate-800 text-xs">{fmt(a.valor_apos)}</td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{a.observacao || '—'}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => removerAporte(a.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button onClick={onFechar} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Editar Caixinha ───────────────────────────────────────────────────

function ModalEditar({ caixinha, onFechar, onSalvo }: {
  caixinha: Caixinha
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    nome: caixinha.nome,
    meta: caixinha.meta?.toString() ?? '',
    prazo: caixinha.prazo ?? '',
    descricao: caixinha.descricao ?? '',
    taxa_rendimento_mensal: caixinha.taxa_rendimento_mensal.toString(),
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    const { error } = await supabase.from('caixinhas').update({
      nome: form.nome,
      meta: form.meta ? parseFloat(form.meta) : null,
      prazo: form.prazo || null,
      descricao: form.descricao || null,
      taxa_rendimento_mensal: parseFloat(form.taxa_rendimento_mensal) || 0.87,
    }).eq('id', caixinha.id)
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Edit2 size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Editar Caixinha</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          {[
            { label: 'Nome *', key: 'nome', type: 'text', placeholder: 'Ex: Reserva Emergência' },
            { label: 'Meta (R$)', key: 'meta', type: 'number', placeholder: '10000' },
            { label: 'Prazo', key: 'prazo', type: 'date', placeholder: '' },
            { label: 'Rendimento mensal (%)', key: 'taxa_rendimento_mensal', type: 'number', placeholder: '0.87' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                step="any" min={f.type === 'number' ? '0' : undefined}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
            <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
            Padrão: <strong>0,87%/mês</strong> = R$ 87 líquidos a cada R$ 10.000 (100% CDI Nubank)
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Card da Caixinha ─────────────────────────────────────────────────────────

function CardCaixinha({ caixinha, aportes, onAtualizar }: {
  caixinha: Caixinha
  aportes: Aporte[]
  onAtualizar: () => void
}) {
  const [modalAporte, setModalAporte] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const meta = caixinha.meta ?? 0
  const progressoPct = meta > 0 ? Math.min(100, (caixinha.valor_atual / meta) * 100) : 0
  const faltam = meta > 0 ? Math.max(0, meta - caixinha.valor_atual) : null
  const rendimentoMensal = caixinha.valor_atual * (caixinha.taxa_rendimento_mensal / 100)
  const rendimentoAcumulado = calcularRendimentoAcumulado(aportes, caixinha.taxa_rendimento_mensal)
  const dias = caixinha.prazo ? diasAte(caixinha.prazo) : null
  const porDia = faltam && dias && dias > 0 ? faltam / dias : null

  // Primeiro e último aporte para exibir período
  const aportesMaisAntigos = [...aportes].filter(a => a.valor_adicionado > 0).sort((a, b) => a.data_aporte.localeCompare(b.data_aporte))
  const primeiroDep = aportesMaisAntigos[0]?.data_aporte ?? null

  async function confirmarAporte(valor: number, data: string, obs: string) {
    const anterior = caixinha.valor_atual
    const apos = anterior + valor
    await supabase.from('caixinhas').update({ valor_atual: apos }).eq('id', caixinha.id)
    await supabase.from('caixinhas_aportes').insert({
      caixinha_id: caixinha.id, valor_adicionado: valor,
      valor_anterior: anterior, valor_apos: apos,
      data_aporte: data, observacao: obs || null,
    })
    setModalAporte(false)
    onAtualizar()
  }

  async function excluir() {
    if (!confirm(`Excluir a caixinha "${caixinha.nome}"? Esta ação não pode ser desfeita.`)) return
    setExcluindo(true)
    await supabase.from('caixinhas').delete().eq('id', caixinha.id)
    onAtualizar()
  }

  return (
    <>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><PiggyBank size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight">{caixinha.nome}</h3>
          </div>
          {meta > 0 && (
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full whitespace-nowrap">
              Meta: {fmt(meta)}
            </span>
          )}
        </div>

        {/* Valores */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-400 font-medium">Saldo atual</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{fmt(caixinha.valor_atual)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">Próximo mês (est.)</div>
            <div className="text-lg font-black text-emerald-600 mt-0.5">+{fmt(rendimentoMensal)}<span className="text-xs font-normal text-slate-400">/mês</span></div>
            <div className="text-[10px] text-slate-400">{caixinha.taxa_rendimento_mensal}% ao mês</div>
          </div>
        </div>

        {/* Rendimento acumulado real */}
        {rendimentoAcumulado > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Rendimento acumulado</div>
              <div className="text-lg font-black text-emerald-700 mt-0.5">+{fmt(rendimentoAcumulado)}</div>
              {primeiroDep && (
                <div className="text-[10px] text-emerald-500 mt-0.5">
                  desde {fmtDate(primeiroDep)} · {aportesMaisAntigos.length} aporte{aportesMaisAntigos.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
              <TrendingUp size={16} />
            </div>
          </div>
        )}

        {/* Barra de progresso */}
        {meta > 0 && (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${progressoPct}%`,
                  background: progressoPct >= 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-600">{progressoPct.toFixed(1)}% concluído</span>
              {faltam !== null && faltam > 0 && (
                <span className="text-slate-400">Faltam {fmt(faltam)}</span>
              )}
              {progressoPct >= 100 && (
                <span className="text-emerald-600 font-bold">✓ Meta atingida!</span>
              )}
            </div>
          </div>
        )}

        {/* Info: faltam / por dia / prazo */}
        {(faltam !== null && faltam > 0 && porDia !== null) && (
          <div className="bg-indigo-50 rounded-xl p-3 flex items-start gap-2">
            <Target size={13} className="text-indigo-500 mt-0.5 shrink-0" />
            <div className="text-xs text-indigo-700">
              <span className="font-bold">Faltam {fmt(faltam)}</span>
              {porDia > 0 && <span className="font-medium text-indigo-500"> · {fmt(porDia)}/dia para alcançar</span>}
            </div>
          </div>
        )}

        {/* Prazo e descrição */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {caixinha.prazo && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Prazo: {fmtDate(caixinha.prazo)}
              {dias !== null && dias > 0 && <span className="text-slate-300">({dias} dias)</span>}
            </span>
          )}
          {caixinha.descricao && (
            <span className="italic">{caixinha.descricao}</span>
          )}
        </div>

        {/* Alertas */}
        {caixinha.prazo && dias !== null && dias <= 30 && faltam !== null && faltam > 0 && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            {dias === 0 ? 'Prazo vencido!' : `Prazo em ${dias} dia${dias !== 1 ? 's' : ''}!`}
          </div>
        )}

        {/* Botões */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <button onClick={() => setModalAporte(true)}
            className="flex flex-col items-center gap-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold transition-all">
            <Plus size={14} /> Adicionar
          </button>
          <button onClick={() => setModalHistorico(true)}
            className="flex flex-col items-center gap-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold transition-all">
            <History size={14} /> Histórico
          </button>
          <button onClick={() => setModalEditar(true)}
            className="flex flex-col items-center gap-1 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-[10px] font-bold transition-all">
            <Edit2 size={14} /> Editar
          </button>
          <button onClick={excluir} disabled={excluindo}
            className="flex flex-col items-center gap-1 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-[10px] font-bold transition-all disabled:opacity-50">
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      </div>

      {modalAporte && (
        <ModalAporte caixinha={caixinha} onFechar={() => setModalAporte(false)} onConfirmar={confirmarAporte} />
      )}
      {modalHistorico && (
        <ModalHistorico caixinha={caixinha} onFechar={() => setModalHistorico(false)} />
      )}
      {modalEditar && (
        <ModalEditar caixinha={caixinha} onFechar={() => setModalEditar(false)} onSalvo={() => { setModalEditar(false); onAtualizar() }} />
      )}
    </>
  )
}

// ─── Formulário: Nova Caixinha ─────────────────────────────────────────────────

function FormNovaCaixinha({ onSalvo, onFechar }: { onSalvo: () => void; onFechar: () => void }) {
  const [form, setForm] = useState({
    nome: '', meta: '', prazo: '', descricao: '', taxa_rendimento_mensal: '0.87',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome) { setErro('Informe um nome.'); return }
    setSalvando(true); setErro(null)
    const { error } = await supabase.from('caixinhas').insert({
      nome: form.nome,
      valor_atual: 0,
      meta: form.meta ? parseFloat(form.meta) : null,
      prazo: form.prazo || null,
      descricao: form.descricao || null,
      taxa_rendimento_mensal: parseFloat(form.taxa_rendimento_mensal) || 0.87,
    })
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <form onSubmit={salvar} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-bold text-slate-700">Nova Caixinha</h3>
      {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome *</label>
          <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Viagem Europa" required
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Meta (R$)</label>
          <input type="number" value={form.meta} onChange={e => setForm({ ...form, meta: e.target.value })}
            placeholder="Ex: 15000" min="0" step="0.01"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prazo</label>
          <input type="date" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rendimento mensal (%)</label>
          <input type="number" value={form.taxa_rendimento_mensal} onChange={e => setForm({ ...form, taxa_rendimento_mensal: e.target.value })}
            step="0.01" min="0"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          <p className="text-[10px] text-slate-400 mt-1">Padrão: 0,87% = R$87/mês por R$10.000 (100% CDI Nubank)</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
          <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
            placeholder="Ex: Reserva para entrada do imóvel"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
        <button type="submit" disabled={salvando}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
          {salvando ? 'Criando...' : 'Criar Caixinha'}
        </button>
      </div>
    </form>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function Caixinhas() {
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([])
  const [todosAportes, setTodosAportes] = useState<Aporte[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const [{ data: cx }, { data: ap }] = await Promise.all([
      supabase.from('caixinhas').select('*').order('created_at', { ascending: true }),
      supabase.from('caixinhas_aportes').select('*').order('data_aporte', { ascending: true }),
    ])
    setCaixinhas(cx || [])
    setTodosAportes(ap || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const totalGuardado = caixinhas.reduce((acc, c) => acc + c.valor_atual, 0)
  const totalRendimento = caixinhas.reduce((acc, c) => acc + c.valor_atual * (c.taxa_rendimento_mensal / 100), 0)
  const totalAcumulado = caixinhas.reduce((acc, c) => {
    const ap = todosAportes.filter(a => a.caixinha_id === c.id)
    return acc + calcularRendimentoAcumulado(ap, c.taxa_rendimento_mensal)
  }, 0)

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
            <PiggyBank size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Caixinhas</h2>
            <p className="text-slate-500 text-sm">Metas de poupança com rendimento automático</p>
          </div>
        </div>
        <button onClick={() => setMostrarForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
          {mostrarForm ? <><X size={13} /> Fechar</> : <><Plus size={13} /> Nova caixinha</>}
        </button>
      </div>

      {/* Resumo global */}
      {caixinhas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Guardado</div>
              <div className="text-2xl font-black text-slate-800 mt-1">{fmt(totalGuardado)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{caixinhas.length} caixinha{caixinhas.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><PiggyBank size={20} /></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Rendimento Mensal</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">+{fmt(totalRendimento)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">estimativa próximo mês</div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <div className="bg-emerald-600 p-5 rounded-2xl text-white shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-200 font-bold uppercase tracking-wider">Já Rendeu</div>
              <div className="text-2xl font-black text-white mt-1">+{fmt(totalAcumulado)}</div>
              <div className="text-[10px] text-emerald-200 mt-0.5">desde os depósitos reais</div>
            </div>
            <div className="p-3 bg-white/20 text-white rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Projeção Anual</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">+{fmt(totalRendimento * 12)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">próximos 12 meses</div>
            </div>
            <div className="p-3 bg-white/10 text-emerald-400 rounded-xl"><TrendingUp size={20} /></div>
          </div>
        </div>
      )}

      {mostrarForm && (
        <FormNovaCaixinha onSalvo={() => { setMostrarForm(false); carregar() }} onFechar={() => setMostrarForm(false)} />
      )}

      {carregando ? (
        <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
      ) : caixinhas.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🐷</p>
          <p className="text-sm font-medium">Nenhuma caixinha ainda.</p>
          <p className="text-xs mt-1 text-slate-300">Clique em "Nova caixinha" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {caixinhas.map(c => (
            <CardCaixinha
              key={c.id}
              caixinha={c}
              aportes={todosAportes.filter(a => a.caixinha_id === c.id)}
              onAtualizar={carregar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
