import { EntradaMercadoria, Produto, sequelize } from '../models/index.js';
import { AppError, exigir } from '../utils/errors.js';
import { entradaPublica } from '../utils/format.js';

const include = [{ model: Produto, as: 'produto' }];
async function detalhe(usuarioId, id, transaction) {
  return EntradaMercadoria.findOne({ where: { usuarioId, id }, include, ...(transaction ? { transaction } : {}) });
}
export async function listar(usuarioId) {
  const entradas = await EntradaMercadoria.findAll({ where: { usuarioId }, include, order: [['id', 'DESC']] });
  return entradas.map(entradaPublica);
}
export async function buscar(usuarioId, id) {
  const entrada = await detalhe(usuarioId, id);
  exigir(entrada, 404, 'Entrada não encontrada.');
  return entradaPublica(entrada);
}
export async function criar(usuarioId, dados) {
  return sequelize.transaction(async (transaction) => {
    const produto = await Produto.findOne({ where: { id: dados.produtoId, usuarioId }, transaction, lock: transaction.LOCK.UPDATE });
    exigir(produto, 404, 'Produto não encontrado.');
    await produto.increment('quantidadeEstoque', { by: dados.quantidade, transaction });
    const entrada = await EntradaMercadoria.create({ ...dados, usuarioId }, { transaction });
    return entradaPublica(await detalhe(usuarioId, entrada.id, transaction));
  });
}
export async function atualizar(usuarioId, id, dados) {
  return sequelize.transaction(async (transaction) => {
    const entrada = await EntradaMercadoria.findOne({ where: { usuarioId, id }, transaction, lock: transaction.LOCK.UPDATE });
    exigir(entrada, 404, 'Entrada não encontrada.');
    const novoId = dados.produtoId ?? entrada.produtoId;
    const novaQtd = dados.quantidade ?? entrada.quantidade;
    const ids = [...new Set([entrada.produtoId, novoId])].sort((a, b) => a - b);
    const produtos = await Produto.findAll({ where: { id: ids, usuarioId }, transaction, lock: transaction.LOCK.UPDATE, order: [['id', 'ASC']] });
    exigir(produtos.length === ids.length, 404, 'Produto não encontrado.');
    const porId = new Map(produtos.map((p) => [p.id, p]));
    const anterior = porId.get(entrada.produtoId);
    const novo = porId.get(novoId);
    if (entrada.produtoId === novoId) {
      const saldo = anterior.quantidadeEstoque + novaQtd - entrada.quantidade;
      if (saldo < 0) throw new AppError(409, 'Não é possível reduzir esta entrada: unidades já saíram do estoque.');
      await anterior.update({ quantidadeEstoque: saldo }, { transaction });
    } else {
      if (anterior.quantidadeEstoque < entrada.quantidade) throw new AppError(409, 'Não é possível transferir a entrada: estoque insuficiente no produto anterior.');
      await anterior.decrement('quantidadeEstoque', { by: entrada.quantidade, transaction });
      await novo.increment('quantidadeEstoque', { by: novaQtd, transaction });
    }
    await entrada.update(dados, { transaction });
    return entradaPublica(await detalhe(usuarioId, id, transaction));
  });
}
export async function excluir(usuarioId, id) {
  await sequelize.transaction(async (transaction) => {
    const entrada = await EntradaMercadoria.findOne({ where: { usuarioId, id }, transaction, lock: transaction.LOCK.UPDATE });
    exigir(entrada, 404, 'Entrada não encontrada.');
    const produto = await Produto.findOne({ where: { id: entrada.produtoId, usuarioId }, transaction, lock: transaction.LOCK.UPDATE });
    exigir(produto, 404, 'Produto não encontrado.');
    if (produto.quantidadeEstoque < entrada.quantidade) throw new AppError(409, 'Não é possível excluir: unidades dessa entrada já foram vendidas.');
    await produto.decrement('quantidadeEstoque', { by: entrada.quantidade, transaction });
    await entrada.destroy({ transaction });
  });
}
