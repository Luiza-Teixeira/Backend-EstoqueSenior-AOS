import { Produto } from "../models/index.js";
import { exigir } from "../utils/errors.js";

// Lista somente os produtos do usuário autenticado.
export async function listar(usuarioId) {
  return Produto.findAll({
    where: { usuarioId },
    order: [["id", "DESC"]],
  });
}

// Busca um produto específico do usuário autenticado.
export async function buscar(usuarioId, id) {
  const produto = await Produto.findOne({
    where: { id, usuarioId },
  });

  exigir(produto, 404, "Produto não encontrado.");

  return produto;
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

  return produto;
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

  return produto;
}

export async function excluir(usuarioId, id) {
  const produto = await Produto.findOne({
    where: { id, usuarioId },
  });

  exigir(produto, 404, "Produto não encontrado.");

  // A exclusão só deve ocorrer quando não houver
  // registros históricos vinculados ao produto.
  const { EntradaMercadoria, ItemVenda } = await import("../models/index.js");

  const entradas = await EntradaMercadoria.count({
    where: { produtoId: id },
  });

  const itensVenda = await ItemVenda.count({
    where: { produtoId: id },
  });

  if (entradas > 0 || itensVenda > 0) {
    const { AppError } = await import("../utils/errors.js");

    throw new AppError(
      409,
      "Não é possível excluir um produto com movimentações registradas.",
    );
  }

  await produto.destroy();
}
