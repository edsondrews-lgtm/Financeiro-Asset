import { useState, type FormEvent } from 'react'
import type { NovoCliente } from '../../lib/gestor/types'

const PLANOS = ['Mensal', 'Bimestral', 'Trimestral', '4 Meses', '5 Meses', 'Semestral', 'Anual']
const FORMAS_PAGAMENTO = ['PIX', 'Cartão', 'Boleto', 'Depósito']
const APLICATIVOS_OFICIAIS = [
  'DREAM TV', 'XCIPTV', 'xcloudTV', 'DUPLEX TV / DUPLEX PLAY', 'IPTV SMARTERS',
  'IPTV PLAYER IO', 'Smart One', 'Smart UP', 'ClouDDy', 'Smart STB', 'Duplecast',
]
const OUTRO_APP = 'Outro'

const VAZIO: NovoCliente = {
  nome: '',
  usuario: '',
  senha: '',
  telefone: '',
  vencimento: '',
  plano: 'Mensal',
  valor: 0,
  telas: 1,
  forma_pagamento: 'PIX',
  servidor: '',
  dispositivo: '',
  aplicativo: '',
  observacao: '',
  indicado_por: '',
  receber_mensagem: true,
  localizacao: '',
  vencimento_aplicativo: null,
  mac: '',
}

interface Props {
  valoresIniciais?: Partial<NovoCliente>
  textoBotao?: string
  onSalvar: (cliente: NovoCliente) => Promise<void>
  onCancelar: () => void
}

export function ClienteForm({ valoresIniciais, textoBotao = 'Salvar cliente', onSalvar, onCancelar }: Props) {
  const [dados, setDados] = useState<NovoCliente>({ ...VAZIO, ...valoresIniciais })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const appAtual = dados.aplicativo ?? ''
  const appEhOficial = !appAtual || APLICATIVOS_OFICIAIS.includes(appAtual)
  const [mostrarAppCustom, setMostrarAppCustom] = useState(!appEhOficial)

  function atualizar<K extends keyof NovoCliente>(campo: K, valor: NovoCliente[K]) {
    setDados((atual) => ({ ...atual, [campo]: valor }))
  }

  function handleAppSelect(valor: string) {
    if (valor === OUTRO_APP) {
      setMostrarAppCustom(true)
      atualizar('aplicativo', '')
    } else {
      setMostrarAppCustom(false)
      atualizar('aplicativo', valor)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!dados.nome.trim() || !dados.telefone.trim() || !dados.vencimento) {
      setErro('Preencha nome, telefone e vencimento.')
      return
    }
    setSalvando(true)
    try {
      await onSalvar(dados)
    } catch (err) {
      console.error('Falha ao salvar cliente:', err)
      const mensagem = err instanceof Error ? err.message : (err as { message?: string })?.message
      setErro(mensagem || 'Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="cliente-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Nome *
          <input value={dados.nome} onChange={(e) => atualizar('nome', e.target.value)} required />
        </label>
        <label>
          Telefone (com DDD) *
          <input
            value={dados.telefone}
            onChange={(e) => atualizar('telefone', e.target.value)}
            placeholder="+55 47 99999-9999"
            required
          />
        </label>
        <label>
          Vencimento *
          <input
            type="date"
            value={dados.vencimento}
            onChange={(e) => atualizar('vencimento', e.target.value)}
            required
          />
        </label>
        <label>
          Plano
          <select value={dados.plano} onChange={(e) => atualizar('plano', e.target.value)}>
            {PLANOS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Valor (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            value={dados.valor}
            onChange={(e) => atualizar('valor', Number(e.target.value))}
          />
        </label>
        <label>
          Telas
          <input
            type="number"
            min="1"
            value={dados.telas}
            onChange={(e) => atualizar('telas', Number(e.target.value))}
          />
        </label>
        <label>
          Forma de pagamento
          <select value={dados.forma_pagamento ?? ''} onChange={(e) => atualizar('forma_pagamento', e.target.value)}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Servidor
          <input value={dados.servidor ?? ''} onChange={(e) => atualizar('servidor', e.target.value)} />
        </label>
        <label>
          Aplicativo
          <select value={mostrarAppCustom ? OUTRO_APP : appAtual} onChange={(e) => handleAppSelect(e.target.value)}>
            <option value="">Selecione…</option>
            {APLICATIVOS_OFICIAIS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
            <option value={OUTRO_APP}>Outro (digitar)</option>
          </select>
        </label>
        {mostrarAppCustom && (
          <label>
            Qual aplicativo?
            <input value={appAtual} onChange={(e) => atualizar('aplicativo', e.target.value)} placeholder="Nome do aplicativo" />
          </label>
        )}
        <label>
          Vencimento do app (opcional)
          <input
            type="date"
            value={dados.vencimento_aplicativo ?? ''}
            onChange={(e) => atualizar('vencimento_aplicativo', e.target.value || null)}
          />
        </label>
        <label>
          Dispositivo
          <input value={dados.dispositivo ?? ''} onChange={(e) => atualizar('dispositivo', e.target.value)} />
        </label>
        <label>
          MAC / identificador do dispositivo
          <input value={dados.mac ?? ''} onChange={(e) => atualizar('mac', e.target.value)} placeholder="00:00:00:00:00:00" />
        </label>
        <label>
          Usuário (login do cliente)
          <input value={dados.usuario ?? ''} onChange={(e) => atualizar('usuario', e.target.value)} />
        </label>
        <label>
          Senha (do cliente)
          <input value={dados.senha ?? ''} onChange={(e) => atualizar('senha', e.target.value)} />
        </label>
        <label>
          Estado
          <input value={dados.localizacao ?? ''} onChange={(e) => atualizar('localizacao', e.target.value)} />
        </label>
        <label>
          Indicado por
          <input value={dados.indicado_por ?? ''} onChange={(e) => atualizar('indicado_por', e.target.value)} />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={dados.receber_mensagem}
            onChange={(e) => atualizar('receber_mensagem', e.target.checked)}
          />
          Aceita receber aviso de vencimento
        </label>
        <label className="full-width">
          Observação
          <textarea
            value={dados.observacao ?? ''}
            onChange={(e) => atualizar('observacao', e.target.value)}
            rows={2}
          />
        </label>
      </div>

      {erro && <p className="form-erro">{erro}</p>}

      <div className="form-actions">
        <button type="button" className="btn-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : textoBotao}
        </button>
      </div>
    </form>
  )
}
