import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Upload, FileText, TrendingUp, TrendingDown, DollarSign,
  X, Check, RefreshCw, Search, ChevronDown, ChevronUp,
  Trash2, Edit2, Plus, Filter, AlertCircle, Save, FolderOpen,
  BarChart3, PieChart, Download, Sparkles
} from 'lucide-react'

interface Extrato {
  id: string
  data: string
  valor: number
  tipo: 'credito' | 'debito'
  descricao: string
  identificador: string | null
  categoria: string
  observacao: string | null
  arquivo_origem: string | null
  data_importacao: string
}

interface LinhaPreview {
  id_temp: number
  data: string
  valor: number
  tipo: 'credito' | 'debito'
  descricao: string
  identificador: string
  categoria: string
  alterada: boolean
}

const CATEGORIA_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Trabalho:     { color: '#2563EB', bg: '#EFF6FF', icon: '💼' },
  Pessoal:      { color: '#7C3AED', bg: '#F5F3FF', icon: '👤' },
  Investimento: { color: '#059669', bg: '#ECFDF5', icon: '📈' },
  Moradia:      { color: '#0284C7', bg: '#F0F9FF', icon: '🏠' },
  Alimentação:  { color: '#E11D48', bg: '#FFF1F2', icon: '🍽️' },
  Transporte:   { color: '#EA580C', bg: '#FFF7ED', icon: '🚗' },
  Serviços:     { color: '#D97706', bg: '#FFFBEB', icon: '🔧' },
  Lazer:        { color: '#059669', bg: '#ECFDF5', icon: '🎮' },
  Assinatura:   { color: '#4338CA', bg: '#EEF2FF', icon: '📋' },
  Impostos:     { color: '#DC2626', bg: '#FEF2F2', icon: '🏛️' },
  Tarifas:      { color: '#64748B', bg: '#F1F5F9', icon: '💸' },
  Doações:      { color: '#DB2777', bg: '#FDF2F8', icon: '❤️' },
  Saúde:        { color: '#0891B2', bg: '#ECFEFF', icon: '🏥' },
  Cartão:       { color: '#0D9488', bg: '#F0FDFA', icon: '💳' },
  Outros:       { color: '#94A3B8', bg: '#F8FAFC', icon: '📦' },
}

const CNPJ_MAP: Record<string, string> = {
  '42.320.627/0001-70': 'Trabalho',
  '33.630.661/0001-50': 'Trabalho',
  '66.467.049/0001-67': 'Trabalho',
  '40.194.032/0001-90': 'Trabalho',
  '38.035.834/0001-05': 'Serviços',
  '34.882.109/0001-11': 'Serviços',
  '65.828.286/0001-43': 'Serviços',
  '66.541.252/0001-36': 'Serviços',
  '65.769.415/0001-70': 'Serviços',
  '66.769.090/0001-98': 'Serviços',
  '11.480.809/0001-84': 'Serviços',
  '64.217.668/0001-78': 'Serviços',
  '66.460.185/0001-25': 'Serviços',
  '65.862.132/0001-78': 'Serviços',
  '65.854.387/0001-99': 'Serviços',
  '37.462.514/0001-79': 'Serviços',
  '66.419.583/0001-06': 'Serviços',
  '20.876.245/0001-94': 'Serviços',
  '52.639.845/0001-25': 'Lazer',
  '61.349.217/0001-04': 'Lazer',
  '58.547.271/0001-41': 'Lazer',
  '53.570.592/0001-43': 'Lazer',
  '66.664.153/0001-41': 'Doações',
  '82.951.310/0001-56': 'Impostos',
  '00.394.460/0058-87': 'Impostos',
  '60.853.264/0001-10': 'Assinatura',
  '19.468.242/0001-32': 'Saúde',
}

function extrairCNPJ(desc: string): string | null {
  const m = desc.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)
  return m ? m[1] : null
}

function extrairEntidade(desc: string): string {
  if (desc.includes('Aplicação RDB') || desc.includes('Resgate RDB')) return 'Nubank RDB'
  if (desc.includes('Pagamento de fatura')) return 'Fatura Cartão'
  if (desc.includes('Débito em conta')) return 'Taxa Bancária'
  if (desc.includes('Pagamento de boleto')) {
    const parts = desc.split(' - ')
    return parts.length > 1 ? parts[1].trim() : 'Boleto'
  }
  const parts = desc.split(' - ')
  if (parts.length >= 2) return parts[1].trim()
  if (desc.includes('Estorno')) {
    const idx = desc.indexOf(' - ')
    return idx > 0 ? desc.slice(idx + 3).split(' - ')[0].trim() : desc.slice(0, 40)
  }
  return desc.slice(0, 40)
}

function extrairTipoTransacao(desc: string): string {
  if (desc.includes('Estorno')) return 'estorno'
  if (desc.includes('Aplicação RDB')) return 'investimento'
  if (desc.includes('Resgate RDB')) return 'resgate'
  if (desc.includes('Pagamento de boleto')) return 'boleto'
  if (desc.includes('Pagamento de fatura')) return 'fatura'
  if (desc.includes('Débito em conta')) return 'débito automático'
  if (desc.includes('Transferência recebida pelo Pix')) return 'pix'
  if (desc.includes('Transferência Recebida')) return 'ted'
  if (desc.includes('Transferência enviada pelo Pix')) return 'pix'
  if (desc.includes('Transferência enviada')) return 'ted'
  return 'outro'
}

const CATEGORIAS = Object.keys(CATEGORIA_CONFIG)

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function ExtratosBancarios() {
  const [extratos, setExtratos] = useState<Extrato[]>([])
  const [loading, setLoading] = useState(true)
  const [regras, setRegras] = useState<Record<string, string>>({})
  const [mesFiltro, setMesFiltro] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [catFiltro, setCatFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'credito' | 'debito'>('todos')
  const [busca, setBusca] = useState('')
  const [preview, setPreview] = useState<LinhaPreview[]>([])
  const [modalPreview, setModalPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState<Extrato | null>(null)
  const [modalEdit, setModalEdit] = useState(false)
  const [formEdit, setFormEdit] = useState({ descricao: '', categoria: '', observacao: '' })
  const [modalCategoria, setModalCategoria] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('extratos_bancarios')
        .select('*')
        .order('data', { ascending: false })
      setExtratos(data ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const carregarRegras = useCallback(async () => {
    try {
      const { data } = await supabase.from('extratos_regras').select('termo_busca, categoria_destino')
      if (data) {
        const m: Record<string, string> = {}
        data.forEach((r: any) => { m[r.termo_busca.toLowerCase()] = r.categoria_destino })
        setRegras(m)
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { carregar(); carregarRegras() }, [carregar, carregarRegras])

  function categorizar(descricao: string, valor: number): string {
    const t = descricao.toLowerCase()
    const cnpj = extrairCNPJ(descricao)

    // 1. CNPJ map (most reliable)
    if (cnpj && CNPJ_MAP[cnpj]) return CNPJ_MAP[cnpj]

    // 2. Keyword priorities (highest confidence first)
    if (t.includes('aplicacao rdb') || t.includes('resgate rdb')) return 'Investimento'
    if (t.includes('pagamento de fatura')) return 'Cartão'
    if (t.includes('receita federal') || t.includes('imposto de renda') || t.includes('darf')) return 'Impostos'
    if (t.includes('debito em conta') || t.includes('taxa bancaria') || t.includes('tarifa')) return 'Tarifas'
    if (t.includes('projeto amor') || t.includes('projeto empatia')) return 'Doações'
    if (t.includes('seguro pag') || t.includes('control digital solutions') || t.includes('gowd instituicao') || t.includes('stark bank')) return 'Trabalho'

    // 3. Company-name matching (extract from " - COMPANY - CNPJ" format)
    const entidade = extrairEntidade(descricao)
    const entidadeLower = entidade.toLowerCase()
    if (entidadeLower.includes('ene lab') || entidadeLower.includes('j e c v technology') ||
        entidadeLower.includes('quantum tech') || entidadeLower.includes('unipay') ||
        entidadeLower.includes('fator growth') || entidadeLower.includes('infinity growth') ||
        entidadeLower.includes('vaultx') || entidadeLower.includes('transfeto') ||
        entidadeLower.includes('ad conveniados') || entidadeLower.includes('pag agente') ||
        entidadeLower.includes('go tecnologia') || entidadeLower.includes('movetech') ||
        entidadeLower.includes('jump facilitadora') || entidadeLower.includes('aeroz') ||
        entidadeLower.includes('exame contabilidade') || entidadeLower.includes('j e c v')) return 'Serviços'
    if (entidadeLower.includes('bolao do milhao') || entidadeLower.includes('eb intermediacoes') ||
        entidadeLower.includes('ea entretenimento') || entidadeLower.includes('ganha sorte') ||
        entidadeLower.includes('just pagamentos')) return 'Lazer'
    if (entidadeLower.includes('celesc') || entidadeLower.includes('edificio') ||
        entidadeLower.includes('condominio') || entidadeLower.includes('residencial')) return 'Moradia'

    // 4. Boleto → extract company
    if (t.includes('pagamento de boleto')) {
      if (entidadeLower.includes('celesc') || entidadeLower.includes('residencial')) return 'Moradia'
      return 'Serviços'
    }

    // 5. Learned rules from extratos_regras
    for (const [termo, cat] of Object.entries(regras)) {
      if (t.includes(termo)) return cat
    }

    // 6. Pix received (positive) → personal income (unless already matched)
    if (t.includes('pix') && t.includes('recebida') && valor > 0) return 'Pessoal'

    return 'Outros'
  }

  function parseCSV(texto: string): LinhaPreview[] {
    const linhas = texto.split('\n').filter(l => l.trim())
    if (linhas.length === 0) return []
    const cabecalho = linhas[0].toLowerCase()
    const temCabecalho = cabecalho.includes('data') || cabecalho.includes('valor') || cabecalho.includes('descrição')
    const inicio = temCabecalho ? 1 : 0
    const resultado: LinhaPreview[] = []
    for (let i = inicio; i < linhas.length; i++) {
      const partes = linhas[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      if (partes.length < 3) continue
      const dataRaw = partes[0].trim()
      const valorRaw = partes[1].trim().replace(/"/g, '')
      const descricao = partes.length > 3 ? partes[3].replace(/"/g, '').trim() : partes[2].replace(/"/g, '').trim()
      const identificador = partes.length > 2 ? partes[2].replace(/"/g, '').trim() : ''
      const valor = parseFloat(valorRaw)
      if (isNaN(valor) || !descricao) continue
      const data = dataRaw.split('/').length === 3 ? `${dataRaw.split('/')[2]}-${dataRaw.split('/')[1]}-${dataRaw.split('/')[0]}` : dataRaw
      const tipo = valor >= 0 ? 'credito' : 'debito'
      const cat = categorizar(descricao, valor)
      resultado.push({ id_temp: i, data, valor: Math.abs(valor), tipo, descricao, identificador, categoria: cat, alterada: false })
    }
    return resultado
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const texto = evt.target?.result as string
      const linhas = parseCSV(texto)
      if (linhas.length === 0) { alert('Nenhuma transação encontrada no CSV. Verifique o formato.'); return }
      setPreview(linhas)
      setModalPreview(true)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.name.endsWith('.csv')) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const texto = evt.target?.result as string
      const linhas = parseCSV(texto)
      if (linhas.length === 0) { alert('Nenhuma transação encontrada.'); return }
      setPreview(linhas)
      setModalPreview(true)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault() }

  function alterarCategoriaPreview(id: number, cat: string) {
    setPreview(prev => prev.map(p => p.id_temp === id ? { ...p, categoria: cat, alterada: true } : p))
  }

  async function confirmarImportacao() {
    const existentes = new Set(extratos.map(e => e.identificador).filter(Boolean))
    const novos = preview.filter(p => !existentes.has(p.identificador))
    if (novos.length === 0) { alert('Todas as transações já foram importadas.'); return }
    setSalvando(true)
    try {
      const dados = novos.map(p => ({
        data: p.data,
        valor: p.tipo === 'debito' ? -p.valor : p.valor,
        tipo: p.tipo,
        descricao: p.descricao,
        identificador: p.identificador,
        categoria: p.categoria,
      }))
      const { error } = await supabase.from('extratos_bancarios').insert(dados)
      if (error) throw error
      const novasRegras: { termo_busca: string; categoria_destino: string }[] = []
      preview.forEach(p => {
        if (p.alterada) {
          const palavra = p.descricao.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
          if (palavra.length > 3) novasRegras.push({ termo_busca: palavra, categoria_destino: p.categoria })
        }
      })
      if (novasRegras.length > 0) {
        await supabase.from('extratos_regras').upsert(novasRegras, { onConflict: 'termo_busca' })
      }
      setModalPreview(false)
      setPreview([])
      await carregar()
      await carregarRegras()
    } catch (e) { console.error(e); alert('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta transação?')) return
    await supabase.from('extratos_bancarios').delete().eq('id', id)
    await carregar()
  }

  function abrirEdicao(e: Extrato) {
    setEditando(e)
    setFormEdit({ descricao: e.descricao, categoria: e.categoria, observacao: e.observacao || '' })
    setModalEdit(true)
  }

  async function salvarEdicao() {
    if (!editando) return
    await supabase.from('extratos_bancarios').update({
      descricao: formEdit.descricao,
      categoria: formEdit.categoria,
      observacao: formEdit.observacao || null,
      data_atualizacao: new Date().toISOString(),
    }).eq('id', editando.id)
    setModalEdit(false)
    setEditando(null)
    await carregar()
  }

  function adicionarCategoria() {
    const nome = novaCategoria.trim()
    if (!nome || CATEGORIAS.includes(nome)) return
    const custom = JSON.parse(localStorage.getItem('extratos_categorias_custom') || '[]') as string[]
    custom.push(nome)
    localStorage.setItem('extratos_categorias_custom', JSON.stringify(custom))
    setNovaCategoria('')
    setModalCategoria(false)
    window.location.reload()
  }

  const categoriasDisponiveis = [
    ...CATEGORIAS,
    ...(JSON.parse(localStorage.getItem('extratos_categorias_custom') || '[]') as string[]).filter(c => !CATEGORIAS.includes(c))
  ]

  const extratosFiltrados = extratos.filter(e => {
    if (mesFiltro && !e.data.startsWith(mesFiltro)) return false
    if (catFiltro && e.categoria !== catFiltro) return false
    if (tipoFiltro !== 'todos' && e.tipo !== tipoFiltro) return false
    if (busca && !e.descricao.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const totalCreditos = extratosFiltrados.filter(e => e.tipo === 'credito').reduce((s, e) => s + e.valor, 0)
  const totalDebitos = extratosFiltrados.filter(e => e.tipo === 'debito').reduce((s, e) => s + Math.abs(e.valor), 0)
  const saldo = totalCreditos - totalDebitos
  const categoriasAgrupadas = extratosFiltrados.filter(e => e.tipo === 'debito').reduce<Record<string, number>>((acc, e) => {
    acc[e.categoria] = (acc[e.categoria] || 0) + Math.abs(e.valor)
    return acc
  }, {})
  const catRanking = Object.entries(categoriasAgrupadas).sort((a, b) => b[1] - a[1])
  const maxCat = catRanking.length > 0 ? Math.max(...catRanking.map(c => c[1])) : 0
  const creditosAgrupados = extratosFiltrados.filter(e => e.tipo === 'credito').reduce<Record<string, number>>((acc, e) => {
    acc[e.categoria] = (acc[e.categoria] || 0) + e.valor
    return acc
  }, {})
  const credRanking = Object.entries(creditosAgrupados).sort((a, b) => b[1] - a[1])
  const maxCred = credRanking.length > 0 ? Math.max(...credRanking.map(c => c[1])) : 0

  // Entity-based rankings (company/person grouping)
  const entidadesCreditos = extratosFiltrados.filter(e => e.tipo === 'credito').reduce<Record<string, number>>((acc, e) => {
    const ent = extrairEntidade(e.descricao)
    acc[ent] = (acc[ent] || 0) + e.valor
    return acc
  }, {})
  const entRankingCred = Object.entries(entidadesCreditos).sort((a, b) => b[1] - a[1])
  const maxEntCred = entRankingCred.length > 0 ? Math.max(...entRankingCred.map(c => c[1])) : 0

  const entidadesDebitos = extratosFiltrados.filter(e => e.tipo === 'debito').reduce<Record<string, number>>((acc, e) => {
    const ent = extrairEntidade(e.descricao)
    acc[ent] = (acc[ent] || 0) + Math.abs(e.valor)
    return acc
  }, {})
  const entRankingDeb = Object.entries(entidadesDebitos).sort((a, b) => b[1] - a[1])
  const maxEntDeb = entRankingDeb.length > 0 ? Math.max(...entRankingDeb.map(c => c[1])) : 0

  // Transaction type breakdown
  const tipoTransacao = extratosFiltrados.reduce<Record<string, { count: number; valor: number }>>((acc, e) => {
    const tipo = extrairTipoTransacao(e.descricao)
    if (!acc[tipo]) acc[tipo] = { count: 0, valor: 0 }
    acc[tipo].count++
    acc[tipo].valor += e.tipo === 'credito' ? e.valor : Math.abs(e.valor)
    return acc
  }, {})
  const tipoRanking = Object.entries(tipoTransacao).sort((a, b) => b[1].valor - a[1].valor)

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl text-white shadow-sm" style={{ backgroundColor: '#0F766E' }}>
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Extratos Bancários</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nubank · {extratos.length} transações</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
            <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}
              className="px-3 py-2 text-xs font-bold border-0 outline-none" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              {Array.from({ length: 24 }, (_, i) => {
                const d = new Date()
                d.setMonth(d.getMonth() - i)
                const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                return <option key={v} value={v}>{MESES[d.getMonth()]} {d.getFullYear()}</option>
              })}
            </select>
          </div>
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all text-white"
            style={{ backgroundColor: '#0F766E' }}>
            <Upload size={13} /> Importar CSV
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
          <button onClick={() => setModalCategoria(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold transition-all border" style={{
              backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)'
            }}>
            <Plus size={13} className="inline mr-1" />Categoria
          </button>
          <button onClick={carregar}
            className="p-2 rounded-xl border transition-all" style={{
              backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)'
            }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 space-y-2 border" style={{
          backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
        }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Receitas</span>
          </div>
          <div className="text-2xl font-black text-emerald-600">{fmt(totalCreditos)}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {extratosFiltrados.filter(e => e.tipo === 'credito').length} transações
          </div>
        </div>
        <div className="rounded-2xl p-5 space-y-2 border" style={{
          backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
        }}>
          <div className="flex items-center gap-2">
            <TrendingDown size={16} style={{ color: '#E11D48' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Despesas</span>
          </div>
          <div className="text-2xl font-black" style={{ color: '#E11D48' }}>{fmt(totalDebitos)}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {extratosFiltrados.filter(e => e.tipo === 'debito').length} transações
          </div>
        </div>
        <div className="rounded-2xl p-5 space-y-2 border" style={{
          backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
        }}>
          <div className="flex items-center gap-2">
            <DollarSign size={16} style={{ color: saldo >= 0 ? '#059669' : '#E11D48' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Saldo do Período</span>
          </div>
          <div className={`text-2xl font-black ${saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmt(saldo)}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {extratosFiltrados.length} transações no período
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {(['todos', 'credito', 'debito'] as const).map(t => (
            <button key={t} onClick={() => setTipoFiltro(t)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all" style={{
                backgroundColor: tipoFiltro === t ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: tipoFiltro === t ? 'white' : 'var(--text-muted)',
              }}>
              {t === 'todos' ? 'Todos' : t === 'credito' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar na descrição..." value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-xl text-xs border w-48" style={{
              backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)'
            }} />
        </div>
      </div>

      {/* Dashboard: Análise de Receitas */}
      {credRanking.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Por Categoria */}
          <div className="rounded-2xl border p-5 space-y-3" style={{
            backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
          }}>
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: '#059669' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Receitas por Categoria</span>
            </div>
            <div className="space-y-2">
              {credRanking.map(([cat, valor]) => {
                const cfg = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG['Outros']
                const pct = maxCred > 0 ? (valor / maxCred) * 100 : 0
                return (
                  <div key={cat} className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setCatFiltro(catFiltro === cat ? '' : cat)}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs" style={{ backgroundColor: cfg.bg }}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{cat}</span>
                        <span className="text-xs font-black text-emerald-600">{fmt(valor)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full mt-1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#059669' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por Entidade */}
          <div className="rounded-2xl border p-5 space-y-3" style={{
            backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
          }}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: '#059669' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Quem te pagou</span>
            </div>
            <div className="space-y-2">
              {entRankingCred.slice(0, 8).map(([ent, valor]) => {
                const pct = maxEntCred > 0 ? (valor / maxEntCred) * 100 : 0
                const count = extratosFiltrados.filter(e => e.tipo === 'credito' && extrairEntidade(e.descricao) === ent).length
                return (
                  <div key={ent} className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: '#059669' }}>
                      {ent.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ent}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{count}x</span>
                          <span className="text-xs font-black text-emerald-600">{fmt(valor)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full mt-1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#059669' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard: Análise de Despesas */}
      {catRanking.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Por Categoria */}
          <div className="rounded-2xl border p-5 space-y-3" style={{
            backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
          }}>
            <div className="flex items-center gap-2">
              <BarChart3 size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Despesas por Categoria</span>
            </div>
            <div className="space-y-2">
              {catRanking.map(([cat, valor]) => {
                const cfg = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG['Outros']
                const pct = maxCat > 0 ? (valor / maxCat) * 100 : 0
                return (
                  <div key={cat} className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setCatFiltro(catFiltro === cat ? '' : cat)}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs" style={{ backgroundColor: cfg.bg }}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{cat}</span>
                        <span className="text-xs font-black" style={{ color: cfg.color }}>{fmt(valor)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full mt-1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Para quem paga */}
          <div className="rounded-2xl border p-5 space-y-3" style={{
            backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
          }}>
            <div className="flex items-center gap-2">
              <DollarSign size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Para quem você paga</span>
            </div>
            <div className="space-y-2">
              {entRankingDeb.slice(0, 8).map(([ent, valor]) => {
                const pct = maxEntDeb > 0 ? (valor / maxEntDeb) * 100 : 0
                const count = extratosFiltrados.filter(e => e.tipo === 'debito' && extrairEntidade(e.descricao) === ent).length
                const cat = categorizar(ent, valor)
                const cfg = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG['Outros']
                return (
                  <div key={ent} className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: cfg.color }}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ent}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{count}x</span>
                          <span className="text-xs font-black" style={{ color: cfg.color }}>{fmt(valor)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full mt-1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tipos de Transação */}
      {tipoRanking.length > 0 && (
        <div className="rounded-2xl border p-5" style={{
          backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
        }}>
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={14} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tipos de Transação</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {tipoRanking.map(([tipo, data]) => {
              const labels: Record<string, string> = {
                pix: 'Pix', ted: 'TED', boleto: 'Boleto', fatura: 'Fatura',
                'débito automático': 'Débito', investimento: 'Aplicação',
                resgate: 'Resgate', estorno: 'Estorno', outro: 'Outro'
              }
              const colors: Record<string, string> = {
                pix: '#059669', ted: '#2563EB', boleto: '#D97706', fatura: '#E11D48',
                'débito automático': '#64748B', investimento: '#0891B2',
                resgate: '#0891B2', estorno: '#7C3AED', outro: '#94A3B8'
              }
              return (
                <div key={tipo} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs" style={{
                  borderColor: colors[tipo] + '40', backgroundColor: colors[tipo] + '10'
                }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[tipo] }} />
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{labels[tipo] || tipo}</span>
                  <span className="font-black" style={{ color: colors[tipo] }}>{data.count}x</span>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(data.valor)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-2xl border overflow-hidden" style={{
        backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'
      }}>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : extratosFiltrados.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <div className="text-4xl">📄</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Nenhuma transação encontrada</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Importe um CSV do Nubank para começar
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider border-b" style={{
                  color: 'var(--text-muted)', borderColor: 'var(--border-color)'
                }}>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-3 py-3">Descrição</th>
                  <th className="text-left px-3 py-3">Categoria</th>
                  <th className="text-right px-3 py-3">Valor</th>
                  <th className="text-right px-3 py-3" style={{ minWidth: 90 }}>Saldo</th>
                  <th className="text-center px-3 py-3" style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {(() => {
                  let acum = 0
                  return extratosFiltrados.map(e => {
                    acum += e.tipo === 'credito' ? e.valor : -Math.abs(e.valor)
                    const cfg = CATEGORIA_CONFIG[e.categoria] || CATEGORIA_CONFIG['Outros']
                    return (
                      <tr key={e.id} className="transition-colors hover:bg-slate-50/30">
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {fmtDate(e.data)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {e.descricao.length > 60 ? e.descricao.slice(0, 60) + '...' : e.descricao}
                          </div>
                          {e.observacao && (
                            <div className="text-[9px] italic mt-0.5" style={{ color: 'var(--text-muted)' }}>{e.observacao}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap" style={{
                            backgroundColor: cfg.bg,
                            color: cfg.color,
                          }}>
                            {cfg.icon} {e.categoria}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span className={`font-bold ${e.tipo === 'credito' ? 'text-emerald-600' : ''}`} style={{
                            color: e.tipo === 'credito' ? undefined : '#E11D48',
                          }}>
                            {e.tipo === 'credito' ? '+' : '-'}{fmt(Math.abs(e.valor))}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span className={`font-bold text-[10px] ${acum >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {fmt(acum)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={() => abrirEdicao(e)}
                              className="p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => excluir(e.id)}
                              className="p-1 rounded transition-colors hover:text-rose-500" style={{ color: 'var(--text-muted)' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Preview */}
      {modalPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" style={{
            backgroundColor: 'var(--bg-secondary)',
          }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
                  <Sparkles size={16} className="text-amber-600" />
                </div>
                <div>
                  <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                    Confirmação de Importação
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {preview.length} transações encontradas · Revise as categorias antes de importar
                  </div>
                </div>
              </div>
              <button onClick={() => { setModalPreview(false); setPreview([]) }}
                className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span className="text-[11px] text-amber-800 font-medium">
                  Categorias sugeridas automaticamente. Altere manualmente se necessário — o sistema aprende com suas correções.
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider border-b" style={{
                    color: 'var(--text-muted)', borderColor: 'var(--border-color)'
                  }}>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-left px-3 py-2">Categoria</th>
                    <th className="text-right px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {preview.map(p => (
                    <tr key={p.id_temp} className="hover:bg-slate-50/30">
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {fmtDate(p.data)}
                      </td>
                      <td className="px-3 py-2 max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
                        <span style={{ color: 'var(--text-primary)' }}>{p.descricao}</span>
                        {p.alterada && (
                          <span className="ml-1.5 text-[8px] px-1 py-0.5 rounded font-bold" style={{
                            backgroundColor: '#FEF3C7', color: '#D97706'
                          }}>Corrigido</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          p.tipo === 'credito' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                        }`}>
                          {p.tipo === 'credito' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select value={p.categoria} onChange={e => alterarCategoriaPreview(p.id_temp, e.target.value)}
                          className="px-1.5 py-1 rounded-lg text-[10px] font-bold border-0 outline-none" style={{
                            backgroundColor: p.alterada ? '#FEF3C7' : 'var(--bg-tertiary)',
                            color: p.alterada ? '#D97706' : 'var(--text-primary)',
                          }}>
                          {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className={`font-bold text-[11px] ${p.tipo === 'credito' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {p.tipo === 'credito' ? '+' : '-'}{fmt(p.valor)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total: {preview.length} transações ·{' '}
                {fmt(preview.filter(p => p.tipo === 'credito').reduce((s, p) => s + p.valor, 0))} em créditos ·{' '}
                {fmt(preview.filter(p => p.tipo === 'debito').reduce((s, p) => s + p.valor, 0))} em débitos
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setModalPreview(false); setPreview([]) }}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all border" style={{
                    color: 'var(--text-secondary)', borderColor: 'var(--border-color)'
                  }}>
                  Cancelar
                </button>
                <button onClick={confirmarImportacao} disabled={salvando}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2"
                  style={{ backgroundColor: '#0F766E' }}>
                  {salvando ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  {salvando ? 'Salvando...' : `Importar ${preview.length} transações`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {modalEdit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4" style={{
            backgroundColor: 'var(--bg-secondary)'
          }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Editar Transação</div>
              <button onClick={() => setModalEdit(false)}
                className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Descrição
                </label>
                <input type="text" value={formEdit.descricao}
                  onChange={e => setFormEdit(p => ({ ...p, descricao: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border mt-1" style={{
                    backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)'
                  }} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Categoria
                </label>
                <select value={formEdit.categoria}
                  onChange={e => setFormEdit(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border mt-1" style={{
                    backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)'
                  }}>
                  {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Observação
                </label>
                <input type="text" value={formEdit.observacao}
                  onChange={e => setFormEdit(p => ({ ...p, observacao: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border mt-1" style={{
                    backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)'
                  }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalEdit(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border" style={{
                  color: 'var(--text-secondary)', borderColor: 'var(--border-color)'
                }}>Cancelar</button>
              <button onClick={salvarEdicao}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: '#0F766E' }}>
                <Save size={13} className="inline mr-1" />Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Categoria */}
      {modalCategoria && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4" style={{
            backgroundColor: 'var(--bg-secondary)'
          }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Nova Categoria</div>
              <button onClick={() => setModalCategoria(false)}
                className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <input type="text" placeholder="Nome da nova categoria..." value={novaCategoria}
              onChange={e => setNovaCategoria(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
              className="w-full px-3 py-2 rounded-xl text-xs border" style={{
                backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)'
              }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalCategoria(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border" style={{
                  color: 'var(--text-secondary)', borderColor: 'var(--border-color)'
                }}>Cancelar</button>
              <button onClick={adicionarCategoria}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: '#0F766E' }}>
                <Plus size={13} className="inline mr-1" />Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
