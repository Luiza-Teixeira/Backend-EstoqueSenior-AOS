import { Venda, ItemVenda, Produto, sequelize } from '../models/index.js';
import { AppError, exigir } from '../utils/errors.js';
import { centavos, reais, vendaPublica } from '../utils/format.js';

const include = [{ model: ItemVenda, as: 'itens' }];
const orderItens = [[{ model: ItemVenda, as: 'itens' }, 'id', 'ASC']];

async function detalhe(usuarioId, id, transaction) {
  return Venda.findOne({
    where: { usuarioId, id },
    include,
    order: orderItens,
    ...(transaction ? { transaction } : {}),
  });
}

export async function listar(usuarioId) {
  const vendas = await Venda.findAll({
    where: { usuarioId },
    include,
    order: [['id', 'DESC'], ...orderItens],
  });
  return vendas.map(vendaPublica);
}

export async function buscar(usuarioId, id) {
  const venda = await detalhe(usuarioId, id);
  exigir(venda, 404, 'Venda não encontrada.');
  return vendaPublica(venda);
}

export async function listarItens(usuarioId, id) {
  const venda = await Venda.findOne({ where: { id, usuarioId } });
  exigir(venda, 404, 'Venda não encontrada.');
  const itens = await ItemVenda.findAll({ where: { vendaId: id }, order: [['id', 'ASC']] });
  return itens.map((i) => ({
    produtoId: i.produtoId,
    nomeProduto: i.nomeProduto,
    quantidade: i.quantidade,
    valorUnitario: Number(i.valorUnitario),
  }));
}

export function calcularMovimentacaoVenda(produtos, itens, existentes = []) {
  const ids = itens.map((i) => i.produtoId);
  if (new Set(ids).size !== ids.length) {
    throw new AppError(400, 'Não repita o mesmo produto na venda.');
  }

  const porId = new Map(produtos.map((p) => [p.id, p]));
  const saldos = new Map(produtos.map((p) => [p.id, p.quantidadeEstoque]));

  for (const item of existentes) {
    saldos.set(item.produtoId, saldos.get(item.produtoId) + item.quantidade);
  }

  for (const item of itens) {
    const produto = porId.get(item.produtoId);
    if (!produto) throw new AppError(404, 'Um dos produtos não foi encontrado.');
    const restante = saldos.get(item.produtoId) - item.quantidade;
    if (restante < 0) {
      throw new AppError(409, `Estoque insuficiente para ${produto.nome}.`);
    }
    saldos.set(item.produtoId, restante);
  }

  let totalCentavos = 0;
  const linhas = itens.map((i) => {
    const produto = porId.get(i.produtoId);
    const precoCentavos = centavos(produto.precoVenda);
    totalCentavos += precoCentavos * i.quantidade;
    return {
      produtoId: i.produtoId,
      quantidade: i.quantidade,
      valorUnitario: reais(precoCentavos),
      nomeProduto: produto.nome,
    };
  });

  if (!Number.isSafeInteger(totalCentavos) || totalCentavos > 100_000_000_00) {
    throw new AppError(400, 'Valor total da venda excedido.');
  }

  return { total: reais(totalCentavos), linhas, saldos };
}

async function atualizarItens(venda, usuarioId, itens, transaction) {
  const ids = itens.map((i) => i.produtoId);
  if (new Set(ids).size !== ids.length) {
    throw new AppError(400, 'Não repita o mesmo produto na venda.');
  }

  const existentes = venda
    ? await ItemVenda.findAll({ where: { vendaId: venda.id }, transaction })
    : [];

  const todasIds = [...new Set([...ids, ...existentes.map((i) => i.produtoId)])].sort((a, b) => a - b);
  const produtos = await Produto.findAll({
    where: { id: todasIds, usuarioId },
    order: [['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (produtos.length !== todasIds.length) {
    throw new AppError(404, 'Um dos produtos não foi encontrado.');
  }

  const { total, linhas, saldos } = calcularMovimentacaoVenda(produtos, itens, existentes);

  for (const produto of produtos) {
    await produto.update({ quantidadeEstoque: saldos.get(produto.id) }, { transaction });
  }
  if (venda) {
    await ItemVenda.destroy({ where: { vendaId: venda.id }, transaction });
  }
  return { total, linhas };
}

export async function criar(usuarioId, dados) {
  return sequelize.transaction(async (transaction) => {
    const { total, linhas } = await atualizarItens(null, usuarioId, dados.itens, transaction);
    const venda = await Venda.create(
      { usuarioId, total, formaPagamento: dados.formaPagamento, cliente: dados.cliente || null },
      { transaction }
    );
    await ItemVenda.bulkCreate(linhas.map((linha) => ({ ...linha, vendaId: venda.id })), { transaction });
    return vendaPublica(await detalhe(usuarioId, venda.id, transaction));
  });
}

export async function atualizar(usuarioId, id, dados) {
  return sequelize.transaction(async (transaction) => {
    const venda = await Venda.findOne({ where: { usuarioId, id }, transaction, lock: transaction.LOCK.UPDATE });
    exigir(venda, 404, 'Venda não encontrada.');

    const atualizacao = {};
    if (dados.itens) {
      const { total, linhas } = await atualizarItens(venda, usuarioId, dados.itens, transaction);
      atualizacao.total = total;
      await ItemVenda.bulkCreate(linhas.map((linha) => ({ ...linha, vendaId: venda.id })), { transaction });
    }
    if (dados.formaPagamento !== undefined) atualizacao.formaPagamento = dados.formaPagamento;
    if (dados.cliente !== undefined) atualizacao.cliente = dados.cliente || null;

    await venda.update(atualizacao, { transaction });
    return vendaPublica(await detalhe(usuarioId, id, transaction));
  });
}

export async function excluir(usuarioId, id) {
  await sequelize.transaction(async (transaction) => {
    const venda = await Venda.findOne({ where: { usuarioId, id }, transaction, lock: transaction.LOCK.UPDATE });
    exigir(venda, 404, 'Venda não encontrada.');

    const itens = await ItemVenda.findAll({ where: { vendaId: id }, transaction });
    const ids = [...new Set(itens.map((i) => i.produtoId))].sort((a, b) => a - b);

    if (ids.length > 0) {
      const produtos = await Produto.findAll({
        where: { id: ids, usuarioId },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (produtos.length !== ids.length) {
        throw new AppError(409, 'Não é possível desfazer: produto associado indisponível.');
      }
      const porId = new Map(produtos.map((p) => [p.id, p]));
      for (const item of itens) {
        await porId.get(item.produtoId).increment('quantidadeEstoque', { by: item.quantidade, transaction });
      }
    }

    await ItemVenda.destroy({ where: { vendaId: id }, transaction });
    await venda.destroy({ transaction });
  });
}