import { Op } from 'sequelize';
import { Produto, EntradaMercadoria, Venda, ItemVenda } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { produtoPublico, entradaPublica, vendaPublica } from '../utils/format.js';

export async function estoque(usuarioId) {
  const produtos = await Produto.findAll({ where: { usuarioId }, order: [['nome', 'ASC']] });
  return produtos.map((p) => ({
    produtoId: p.id, nomeProduto: p.nome,
    quantidadeEstoque: p.quantidadeEstoque, estoqueMinimo: p.estoqueMinimo,
    estoqueBaixo: p.quantidadeEstoque <= p.estoqueMinimo,
  }));
}
export async function estoqueBaixo(usuarioId) {
  return (await estoque(usuarioId)).filter((p) => p.estoqueBaixo);
}
export function inicioHojeLocal() {
  const dia = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  return new Date(`${dia}T03:00:00.000Z`);
}
export async function resumo(usuarioId) {
  const [produtos, vendas] = await Promise.all([
    Produto.findAll({ where: { usuarioId } }),
    Venda.findAll({ where: { usuarioId, createdAt: { [Op.gte]: inicioHojeLocal() } } }),
  ]);
  return {
    totalProdutosCadastrados: produtos.length,
    quantidadeProdutosEstoqueBaixo: produtos.filter((p) => p.quantidadeEstoque <= p.estoqueMinimo).length,
    quantidadeProdutosSemEstoque: produtos.filter((p) => p.quantidadeEstoque === 0).length,
    quantidadeVendasDia: vendas.length,
    valorTotalVendidoDia: Number(vendas.reduce((s, v) => s + Math.round(Number(v.total) * 100), 0) / 100),
  };
}
export async function historico(usuarioId) {
  const [entradas, vendas] = await Promise.all([
    EntradaMercadoria.findAll({ where: { usuarioId }, include: [{ model: Produto, as: 'produto' }] }),
    Venda.findAll({ where: { usuarioId }, include: [{ model: ItemVenda, as: 'itens' }] }),
  ]);
  const movimentos = entradas.map((e) => ({
    id: `entrada-${e.id}`, tipo: 'ENTRADA', referenciaId: e.id,
    produtoId: e.produtoId, nomeProduto: e.produto.nome,
    quantidade: e.quantidade, valorUnitario: Number(e.custoUnitario), dataHora: e.createdAt.toISOString(),
  }));
  for (const venda of vendas) {
    for (const item of venda.itens) movimentos.push({
      id: `saida-${item.id}`, tipo: 'SAIDA', referenciaId: venda.id,
      produtoId: item.produtoId, nomeProduto: item.nomeProduto,
      quantidade: item.quantidade, valorUnitario: Number(item.valorUnitario), dataHora: venda.createdAt.toISOString(),
    });
  }
  return movimentos.sort((a, b) => b.dataHora.localeCompare(a.dataHora));
}
export async function movimentacao(usuarioId, id) {
  const itens = await historico(usuarioId);
  const item = itens.find((m) => m.id === id);
  if (!item) throw new AppError(404, 'Movimentação não encontrada.');
  return item;
}
