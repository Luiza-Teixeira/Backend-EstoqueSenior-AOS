export const centavos = (valor) => Math.round(Number(valor) * 100);
export const reais = (valorCentavos) => Number((valorCentavos / 100).toFixed(2));
export const usuarioPublico = (u) => ({ id: u.id, nome: u.nome, email: u.email });
export const produtoPublico = (p) => ({
  id: p.id, nome: p.nome, precoVenda: Number(p.precoVenda),
  quantidadeEstoque: p.quantidadeEstoque, estoqueMinimo: p.estoqueMinimo,
  ...(p.categoria != null ? { categoria: p.categoria } : {}),
  ...(p.descricao != null ? { descricao: p.descricao } : {}),
});
export const entradaPublica = (e) => ({
  id: e.id, produto: { id: e.produto.id, nome: e.produto.nome },
  quantidade: e.quantidade, custoUnitario: Number(e.custoUnitario),
  dataHora: e.createdAt.toISOString(),
  ...(e.fornecedor ? { fornecedor: e.fornecedor } : {}),
  ...(e.observacao ? { observacao: e.observacao } : {}),
});
export const vendaPublica = (v) => ({
  id: v.id, itens: (v.itens || []).map((i) => ({
    produtoId: i.produtoId, nomeProduto: i.nomeProduto,
    quantidade: i.quantidade, valorUnitario: Number(i.valorUnitario),
  })), total: Number(v.total), formaPagamento: v.formaPagamento,
  ...(v.cliente ? { cliente: v.cliente } : {}),
  dataHora: v.createdAt.toISOString(),
});
