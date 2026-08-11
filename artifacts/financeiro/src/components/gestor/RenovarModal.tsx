import { useState } from 'react'
import type { Cliente } from '../../lib/gestor/types'
import { calcularProximoVencimento, mesesDoPlano, somarMeses } from '../../lib/gestor/planos'
import { formatarData } from '../../lib/gestor/format'

interface Props {
  cliente: Cliente
  onConfirmar: (novoVencimento: string) => Promise<void>
  onCancelar: () => void
}

export function RenovarModal({ cliente, onConfirmar, onCancelar }: Props) {
  const sugerido = calcularProximoVencimento(cliente.vencimento, cliente.plano)
  const [novoVencimento, setNovoVencimento] = useState(sugerido)
  const [salvando, setSalvando] = useState(false)

  const mesesPlano = mesesDoPlano(cliente.plano)
  const atalhos = [
    { label: `Plano atual (${cliente.plano})`, meses: mesesPlano, destaque: true },
    { label: '+1 mês', meses: 1, destaque: mesesPlano === 1 },
    { label: '+3 meses', meses: 3, destaque: mesesPlano === 3 },
    { label: '+6 meses', meses: 6, destaque: mesesPlano === 6 },
    { label: '+12 meses', meses: 12, destaque: mesesPlano === 12 },
  ].filter((a, i, arr) => arr.findIndex((x) => x.meses === a.meses) === i)

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
        <h3>Renovar {cliente.nome}</h3>
        <p className="modal-sub">
          Vencimento atual <b>{formatarData(cliente.vencimento)}</b>
        </p>

        <div className="atalhos-renovar">
          {atalhos.map((a) => {
            const data = somarMeses(cliente.vencimento, a.meses)
            const ativo = data === novoVencimento
            return (
              <button
                key={a.label}
                type="button"
                className={`chip-atalho ${ativo ? 'chip-atalho-ativo' : ''}`}
                onClick={() => setNovoVencimento(data)}
              >
                {a.label}
              </button>
            )
          })}
        </div>

        <label>
          Ou escolha a data
          <input type="date" value={novoVencimento} onChange={(e) => setNovoVencimento(e.target.value)} />
        </label>

        <div className="renovar-preview">
          Novo vencimento: <b>{formatarData(novoVencimento)}</b>
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
