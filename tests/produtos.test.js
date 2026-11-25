import test from "node:test";
import assert from "node:assert/strict";

import {
  produtoCriarSchema,
  produtoAtualizarSchema,
} from "../src/validators/produtos.schema.js";

import { AppError, validar } from "../src/utils/errors.js";

test("aceita cadastro de produto válido", () => {
  const produto = validar(produtoCriarSchema, {
    nome: "Arroz 1kg",
    precoVenda: 8.5,
    quantidadeEstoque: 10,
    estoqueMinimo: 3,
    categoria: "Alimentos",
  });

  assert.equal(produto.nome, "Arroz 1kg");
  assert.equal(produto.precoVenda, 8.5);
  assert.equal(produto.quantidadeEstoque, 10);
});

test("aplica estoque padrão igual a zero", () => {
  const produto = validar(produtoCriarSchema, {
    nome: "Feijão 1kg",
    precoVenda: 7.9,
  });

  assert.equal(produto.quantidadeEstoque, 0);
  assert.equal(produto.estoqueMinimo, 0);
});

test("rejeita produto sem nome", () => {
  assert.throws(
    () =>
      validar(produtoCriarSchema, {
        precoVenda: 10,
      }),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test("rejeita preço negativo", () => {
  assert.throws(
    () =>
      validar(produtoCriarSchema, {
        nome: "Café",
        precoVenda: -5,
      }),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test("rejeita estoque negativo", () => {
  assert.throws(
    () =>
      validar(produtoCriarSchema, {
        nome: "Leite",
        precoVenda: 6,
        quantidadeEstoque: -2,
      }),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test("rejeita alteração direta do estoque", () => {
  assert.throws(
    () =>
      validar(produtoAtualizarSchema, {
        quantidadeEstoque: 100,
      }),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test("rejeita atualização vazia", () => {
  assert.throws(
    () => validar(produtoAtualizarSchema, {}),
    (err) => err instanceof AppError && err.status === 400,
  );
});

test("aceita atualização de preço", () => {
  const produto = validar(produtoAtualizarSchema, {
    precoVenda: 12.9,
  });

  assert.equal(produto.precoVenda, 12.9);
});

test("rejeita alteração de usuarioId", () => {
  assert.throws(
    () =>
      validar(produtoCriarSchema, {
        nome: "Arroz",
        precoVenda: 8.5,
        usuarioId: 999,
      }),
    (err) => err instanceof AppError && err.status === 400,
  );
});
