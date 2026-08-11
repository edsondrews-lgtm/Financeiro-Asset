import { supabase } from '../supabaseClient'
import type { Cliente } from './types'

// Registra a renovação como um pagamento de verdade, pra entrar no faturamento mensal.
export async function registrarPagamento(cliente: Cliente): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('pagamentos').insert({
    cliente_usuario: cliente.usuario,
    data_pagamento: hoje,
    plano: cliente.plano,
    valor: cliente.valor,
    forma_pagamento: cliente.forma_pagamento,
    servidor: cliente.servidor,
    aplicativo: cliente.aplicativo,
  })
  if (error) throw error
}
