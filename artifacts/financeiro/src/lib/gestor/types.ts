export interface Cliente {
  id: string
  nome: string
  usuario: string | null
  senha: string | null
  telefone: string
  vencimento: string // date YYYY-MM-DD
  vencimento_aplicativo: string | null // date YYYY-MM-DD
  plano: string
  valor: number
  telas: number
  forma_pagamento: string | null
  servidor: string | null
  dispositivo: string | null
  aplicativo: string | null
  mac: string | null
  observacao: string | null
  indicado_por: string | null
  receber_mensagem: boolean
  localizacao: string | null
  arquivado: boolean
  arquivado_em: string | null
  reconquista_tentada_em: string | null
  aviso_enviado_em: string | null
  criado_em: string
  atualizado_em: string
}

export type NovoCliente = Pick<
  Cliente,
  | 'nome'
  | 'usuario'
  | 'senha'
  | 'telefone'
  | 'vencimento'
  | 'plano'
  | 'valor'
  | 'telas'
  | 'forma_pagamento'
  | 'servidor'
  | 'dispositivo'
  | 'aplicativo'
  | 'observacao'
  | 'indicado_por'
  | 'receber_mensagem'
  | 'localizacao'
  | 'vencimento_aplicativo'
  | 'mac'
>
