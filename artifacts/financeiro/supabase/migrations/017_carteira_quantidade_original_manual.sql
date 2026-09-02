-- Desfaz o backfill automático da migration 016 (que calculava a quantidade
-- original a partir do histórico de vendas). A partir de agora esse campo é
-- só manual — o usuário ajusta pelo formulário de editar ativo.
UPDATE carteira_investimentos SET quantidade_original = quantidade;
