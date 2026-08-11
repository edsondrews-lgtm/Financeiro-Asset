import { useState } from 'react'
import type { Cliente } from '../../lib/gestor/types'
import { somarMeses } from '../../lib/gestor/planos'
import { formatarData } from '../../lib/gestor/format'

interface Props {
  cliente: Cliente
  onConfirmar: (novoVencimento: string) => Promise<void>
  onCancelar: () => void
}

const ATALHOS_MESES = [1, 3, 6, 12]

export function RenovarAppModal({ cliente, onConfirmar, onCancelar }: Props) {
  const base = cliente.vencimento_aplicativo ?? new Date().toISOString().slice(0, 10)
  const [novoVencimento, setNovoVencimento] = useState(somarMeses(base, 1))
  const [salvando, setSalvando] = useState(false)

  async function confirmar() {
    setSalvando(true)
    try {
      await onConfirmar(novoVencimento)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancelar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Renovar app de {cliente.nome}</h3>
        <p className="modal-sub">
          {cliente.aplicativo ?? 'Aplicativo'} · vencimento atual{' '}
          <b>{cliente.vencimento_aplicativo ? formatarData(cliente.vencimento_aplicativo) : 'sem controle'}</b>
        </p>

        <div className="atalhos-renovar">
          {ATALHOS_MESES.map((meses) => {
            const data = somarMeses(base, meses)
            const ativo = data === novoVencimento
            return (
              <button
                key={meses}
                type="button"
                className={`chip-atalho ${ativo ? 'chip-atalho-ativo' : ''}`}
                onClick={() => setNovoVencimento(data)}
              >
                +{meses} {meses === 1 ? 'mês' : 'meses'}
              </button>
            )
          })}
        </div>

        <label>
          Ou escolha a data
          <input type="date" value={novoVencimento} onChange={(e) => setNovoVencimento(e.target.value)} />
        </label>

        <div className="renovar-preview">
          Novo vencimento do app: <b>{formatarData(novoVencimento)}</b>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secundario" onClick={onCancelar}>Cancelar</button>
          <button type="button" onClick={confirmar} disabled={salvando}>
            {salvando ? 'Renovando…' : 'Confirmar renovação'}
          </button>
        </div>
      </div>
    </div>
  )
}
