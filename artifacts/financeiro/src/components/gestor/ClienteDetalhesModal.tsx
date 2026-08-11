import type { Cliente } from '../../lib/gestor/types'

interface Props {
  cliente: Cliente
  onFechar: () => void
}

function formatarData(iso: string | null) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarDataHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="detalhe-campo">
      <span className="detalhe-label">{label}</span>
      <span className="detalhe-valor">{valor ?? '—'}</span>
    </div>
  )
}

export function ClienteDetalhesModal({ cliente: c, onFechar }: Props) {
  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card modal-card-larga" onClick={(e) => e.stopPropagation()}>
        <div className="cliente-cell">
          <span className="avatar avatar-grande">
            {c.nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </span>
          <div>
            <h3>{c.nome}</h3>
            {c.arquivado && <span className="pill status-vencido">Arquivado</span>}
          </div>
        </div>

        <div className="detalhes-grid">
          <Campo label="Telefone" valor={c.telefone} />
          <Campo label="Usuário (login)" valor={c.usuario} />
          <Campo label="Senha" valor={c.senha} />
          <Campo label="Vencimento" valor={formatarData(c.vencimento)} />
          <Campo label="Vencimento do app" valor={formatarData(c.vencimento_aplicativo)} />
          <Campo label="Plano" valor={c.plano} />
          <Campo label="Valor" valor={c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
          <Campo label="Telas" valor={c.telas} />
          <Campo label="Forma de pagamento" valor={c.forma_pagamento} />
          <Campo label="Servidor" valor={c.servidor} />
          <Campo label="Aplicativo" valor={c.aplicativo} />
          <Campo label="Dispositivo" valor={c.dispositivo} />
          <Campo label="MAC" valor={c.mac} />
          <Campo label="Estado" valor={c.localizacao} />
          <Campo label="Indicado por" valor={c.indicado_por} />
          <Campo label="Aceita receber aviso" valor={c.receber_mensagem ? 'Sim' : 'Não'} />
          <Campo label="Cadastrado em" valor={formatarDataHora(c.criado_em)} />
          {c.arquivado && <Campo label="Arquivado em" valor={formatarDataHora(c.arquivado_em)} />}
        </div>

        {c.observacao && (
          <div className="detalhe-campo detalhe-obs">
            <span className="detalhe-label">Observação</span>
            <span className="detalhe-valor">{c.observacao}</span>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-secundario" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
