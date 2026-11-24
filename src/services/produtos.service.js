import { produtoPublico } from "../utils/format.js";
import { Produto, EntradaMercadoria, ItemVenda } from "../models/index.js";

import { AppError, exigir } from "../utils/errors.js";

// Lista somente os produtos do usuário autenticado.
export async function listar(usuarioId) {
  const produtos = await Produto.findAll({
    where: { usuarioId },
    order: [["id", "DESC"]],
  });

  return produtos.map(produtoPublico);
}

// Busca um produto específico do usuário autenticado.
export async function buscar(usuarioId, id) {
  const produto = await Produto.findOne({
    where: { id, usuarioId },
  });

  exigir(produto, 404, "Produto não encontrado.");

  return produtoPublico(produto);
}

export async function criar(usuarioId, dados) {
  const produto = await Produto.create({
    nome: dados.nome,
    precoVenda: dados.precoVenda,
    quantidadeEstoque: dados.quantidadeEstoque ?? 0,
    estoqueMinimo: dados.estoqueMinimo ?? 0,
    categoria: dados.categoria ?? null,
    descricao: dados.descricao ?? null,
    usuarioId,
  });

  return produtoPublico(produto);
}

export async function atualizar(usuarioId, id, dados) {
  const produto = await Produto.findOne({
    where: { id, usuarioId },
  });

  exigir(produto, 404, "Produto não encontrado.");

  // Não permite alterar o proprietário do produto.
  const { nome, precoVenda, estoqueMinimo, categoria, descricao } = dados;

  const alteracoes = {};

  if (nome !== undefined) alteracoes.nome = nome;
  if (precoVenda !== undefined) alteracoes.precoVenda = precoVenda;
  if (estoqueMinimo !== undefined) alteracoes.estoqueMinimo = estoqueMinimo;
  if (categoria !== undefined) alteracoes.categoria = categoria;
  if (descricao !== undefined) alteracoes.descricao = descricao;

  await produto.update(alteracoes);

  return produtoPublico(produto);
}

export async function excluir(usuarioId, id) {
  const produto = await Produto.findOne({
    where: { id, usuarioId },
  });

  exigir(produto, 404, "Produto não encontrado.");

  const entradas = await EntradaMercadoria.count({
    where: { produtoId: id },
  });

  const itensVenda = await ItemVenda.count({
    where: { produtoId: id },
  });

  if (entradas > 0 || itensVenda > 0) {
    throw new AppError(
      409,
      "Não é possível excluir um produto com movimentações registradas.",
    );
  }

  await produto.destroy();
}
