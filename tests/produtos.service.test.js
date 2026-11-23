import test from "node:test";
import assert from "node:assert/strict";

// Ambiente fictício para testes sem PostgreSQL
process.env.DATABASE_URL ||= "postgresql://teste:teste@localhost:5432/teste";
process.env.JWT_SECRET ||= "chave_de_teste_local_sem_uso_em_producao_123456";

const { Produto, EntradaMercadoria, ItemVenda } =
  await import("../src/models/index.js");
const { AppError } = await import("../src/utils/errors.js");
const { listar, buscar, criar, atualizar, excluir } =
  await import("../src/services/produtos.service.js");
// TESTE 1 — Listar produtos do usuário
test("lista somente produtos do usuário autenticado", async (t) => {
  const produtos = [
    { id: 1, nome: "Arroz", usuarioId: 7 },
    { id: 2, nome: "Feijão", usuarioId: 7 },
  ];

  t.mock.method(Produto, "findAll", async (opcoes) => {
    assert.deepEqual(opcoes.where, { usuarioId: 7 });
    return produtos;
  });

  const resultado = await listar(7);

  assert.deepEqual(resultado, produtos);
});

// TESTE 2 — Buscar produto existente
test("busca produto pelo ID e usuário", async (t) => {
  const produto = {
    id: 1,
    nome: "Arroz",
    usuarioId: 7,
  };

  t.mock.method(Produto, "findOne", async (opcoes) => {
    assert.deepEqual(opcoes.where, {
      id: 1,
      usuarioId: 7,
    });

    return produto;
  });

  const resultado = await buscar(7, 1);

  assert.deepEqual(resultado, produto);
});

// TESTE 3 — Produto inexistente
test("retorna erro 404 quando produto não existe", async (t) => {
  t.mock.method(Produto, "findOne", async () => null);

  await assert.rejects(
    () => buscar(7, 999),
    (erro) => erro instanceof AppError && erro.status === 404,
  );
});

test("cadastra produto associado ao usuário autenticado", async (t) => {
  const dados = {
    nome: "Arroz 1kg",
    precoVenda: 8.5,
    quantidadeEstoque: 10,
    estoqueMinimo: 3,
    categoria: "Alimentos",
  };

  t.mock.method(Produto, "create", async (registro) => {
    assert.equal(registro.usuarioId, 7);
    assert.equal(registro.nome, "Arroz 1kg");
    assert.equal(registro.quantidadeEstoque, 10);

    return { id: 1, ...registro };
  });

  const resultado = await criar(7, dados);

  assert.equal(resultado.id, 1);
  assert.equal(resultado.usuarioId, 7);
  assert.equal(resultado.nome, "Arroz 1kg");
});

test("atualiza os dados de um produto do usuário", async (t) => {
  const produto = {
    id: 1,
    nome: "Arroz",
    precoVenda: 8.5,
    quantidadeEstoque: 10,
    usuarioId: 7,

    async update(alteracoes) {
      Object.assign(this, alteracoes);
      return this;
    },
  };

  t.mock.method(Produto, "findOne", async (opcoes) => {
    assert.deepEqual(opcoes.where, {
      id: 1,
      usuarioId: 7,
    });

    return produto;
  });

  const resultado = await atualizar(7, 1, {
    nome: "Arroz Premium",
    precoVenda: 12.9,
  });

  assert.equal(resultado.nome, "Arroz Premium");
  assert.equal(resultado.precoVenda, 12.9);
  assert.equal(resultado.quantidadeEstoque, 10);
  assert.equal(resultado.usuarioId, 7);
});

test("impede atualizar produto de outro usuário", async (t) => {
  t.mock.method(Produto, "findOne", async (opcoes) => {
    assert.deepEqual(opcoes.where, {
      id: 1,
      usuarioId: 7,
    });

    return null;
  });

  await assert.rejects(
    () => atualizar(7, 1, { nome: "Produto alterado" }),
    (erro) => erro instanceof AppError && erro.status === 404,
  );
});

test("exclui produto sem movimentações", async (t) => {
  let excluido = false;

  const produto = {
    id: 1,
    usuarioId: 7,
    async destroy() {
      excluido = true;
    },
  };

  t.mock.method(Produto, "findOne", async (opcoes) => {
    assert.deepEqual(opcoes.where, { id: 1, usuarioId: 7 });
    return produto;
  });

  t.mock.method(EntradaMercadoria, "count", async () => 0);
  t.mock.method(ItemVenda, "count", async () => 0);

  await excluir(7, 1);

  assert.equal(excluido, true);
});

test("impede excluir produto com entrada de mercadoria", async (t) => {
  let excluido = false;

  t.mock.method(Produto, "findOne", async () => ({
    id: 1,
    usuarioId: 7,
    async destroy() {
      excluido = true;
    },
  }));

  t.mock.method(EntradaMercadoria, "count", async () => 2);
  t.mock.method(ItemVenda, "count", async () => 0);

  await assert.rejects(
    () => excluir(7, 1),
    (erro) => erro instanceof AppError && erro.status === 409,
  );

  assert.equal(excluido, false);
});

test("impede excluir produto com vendas registradas", async (t) => {
  let excluido = false;

  t.mock.method(Produto, "findOne", async () => ({
    id: 1,
    usuarioId: 7,
    async destroy() {
      excluido = true;
    },
  }));

  t.mock.method(EntradaMercadoria, "count", async () => 0);
  t.mock.method(ItemVenda, "count", async () => 3);

  await assert.rejects(
    () => excluir(7, 1),
    (erro) => erro instanceof AppError && erro.status === 409,
  );

  assert.equal(excluido, false);
});

test("retorna erro 404 ao excluir produto inexistente", async (t) => {
  t.mock.method(Produto, "findOne", async () => null);

  await assert.rejects(
    () => excluir(7, 999),
    (erro) => erro instanceof AppError && erro.status === 404,
  );
});
