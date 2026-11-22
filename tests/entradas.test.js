
import 'dotenv/config';
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Exige uma conexão específica para testes.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'Defina TEST_DATABASE_URL com a conexão de um banco exclusivo para testes.'
  );
}

if (
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL === testDatabaseUrl
) {
  throw new Error(
    'TEST_DATABASE_URL deve ser diferente de DATABASE_URL.'
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';

process.env.JWT_SECRET ||=
  'chave_de_teste_com_mais_de_32_caracteres_123456';

const {
  sequelize,
  Usuario,
  Produto,
  EntradaMercadoria,
} = await import('../src/models/index.js');

const service = await import('../src/services/entradas.service.js');
const { AppError } = await import('../src/utils/errors.js');

let usuario;
let produtosCriados = [];
let entradasCriadas = [];

// Cria um produto verdadeiro no PostgreSQL.
async function criarProduto(estoque = 10) {
  const produto = await Produto.create({
    usuarioId: usuario.id,
    nome: 'Produto de Teste',
    precoVenda: 15.90,
    quantidadeEstoque: estoque,
    estoqueMinimo: 2,
  });

  produtosCriados.push(produto.id);
  return produto;
}

// Cria uma entrada inicial diretamente no banco.
// Usado para preparar os testes de atualização e exclusão.
async function criarEntrada(produto, quantidade = 4) {
  const entrada = await EntradaMercadoria.create({
    usuarioId: usuario.id,
    produtoId: produto.id,
    quantidade,
    custoUnitario: 5.00,
    fornecedor: 'Fornecedor Teste',
    observacao: 'Entrada para teste de integração',
  });

  entradasCriadas.push(entrada.id);
  return entrada;
}

async function estoqueAtual(id) {
  const produto = await Produto.findByPk(id);
  return produto.quantidadeEstoque;
}

function erro(status) {
  return e => e instanceof AppError && e.status === status;
}

// Verifica a conexão e a existência das tabelas.
before(async () => {
  await sequelize.authenticate();

  for (const model of [Usuario, Produto, EntradaMercadoria]) {
    await model.describe();
  }

  console.log('Conexão com PostgreSQL estabelecida.');
});

// Cada teste recebe um usuário próprio.
beforeEach(async () => {
  produtosCriados = [];
  entradasCriadas = [];

  usuario = await Usuario.create({
    nome: 'Usuario Teste Integracao',
    email: `teste-${crypto.randomUUID()}@example.com`,
    senhaHash: 'hash_ficticio_para_teste',
  });
});

// Limpa os registros de cada teste.
afterEach(async () => {
  if (!usuario) return;

  try {
    await EntradaMercadoria.destroy({
      where: { usuarioId: usuario.id },
    });

    await Produto.destroy({
      where: { usuarioId: usuario.id },
    });

    await Usuario.destroy({
      where: { id: usuario.id },
    });
  } finally {
    usuario = null;
  }
});

after(async () => {
  await sequelize.close();
});

// TESTE 1 - CADASTRAR ENTRADA
test('criar entrada aumenta estoque e registra no banco', async () => {
  const produto = await criarProduto(10);

  const resultado = await service.criar(usuario.id, {
    produtoId: produto.id,
    quantidade: 4,
    custoUnitario: 5,
    fornecedor: 'Fornecedor Teste',
  });

  assert.equal(await estoqueAtual(produto.id), 14);

  const entrada = await EntradaMercadoria.findOne({
    where: {
      usuarioId: usuario.id,
      produtoId: produto.id,
    },
  });

  assert.ok(entrada);
  assert.equal(entrada.quantidade, 4);
  assert.equal(entrada.usuarioId, usuario.id);
  assert.equal(resultado.id, entrada.id);
});

// TESTE 2 - PRODUTO INEXISTENTE
test('não cria entrada para produto inexistente', async () => {
  await assert.rejects(
    service.criar(usuario.id, {
      produtoId: 999999999,
      quantidade: 2,
      custoUnitario: 5,
    }),
    erro(404)
  );

  const quantidade = await EntradaMercadoria.count({
    where: { usuarioId: usuario.id },
  });

  assert.equal(quantidade, 0);
});

// TESTE 3 - EDITAR QUANTIDADE
test('editar quantidade aplica somente a diferença', async () => {
  const produto = await criarProduto(14);
  const entrada = await criarEntrada(produto, 4);

  await service.atualizar(usuario.id, entrada.id, {
    quantidade: 6,
  });

  assert.equal(await estoqueAtual(produto.id), 16);

  await entrada.reload();
  assert.equal(entrada.quantidade, 6);
});

// TESTE 4 - IMPEDIR ESTOQUE NEGATIVO
test('não permite reduzir entrada se o estoque ficar negativo', async () => {
  const produto = await criarProduto(2);
  const entrada = await criarEntrada(produto, 4);

  await assert.rejects(
    service.atualizar(usuario.id, entrada.id, {
      quantidade: 1,
    }),
    erro(409)
  );

  assert.equal(await estoqueAtual(produto.id), 2);

  await entrada.reload();
  assert.equal(entrada.quantidade, 4);
});

// TESTE 5 - TRANSFERIR ENTRE PRODUTOS
test('transferir entrada ajusta os dois estoques', async () => {
  const antigo = await criarProduto(10);
  const novo = await criarProduto(3);
  const entrada = await criarEntrada(antigo, 4);

  await service.atualizar(usuario.id, entrada.id, {
    produtoId: novo.id,
    quantidade: 5,
  });

  assert.equal(await estoqueAtual(antigo.id), 6);
  assert.equal(await estoqueAtual(novo.id), 8);

  await entrada.reload();
  assert.equal(entrada.produtoId, novo.id);
  assert.equal(entrada.quantidade, 5);
});

// TESTE 6 - TRANSFERÊNCIA SEM ESTOQUE
test('impede transferência sem estoque suficiente', async () => {
  const antigo = await criarProduto(2);
  const novo = await criarProduto(3);
  const entrada = await criarEntrada(antigo, 4);

  await assert.rejects(
    service.atualizar(usuario.id, entrada.id, {
      produtoId: novo.id,
    }),
    erro(409)
  );

  assert.equal(await estoqueAtual(antigo.id), 2);
  assert.equal(await estoqueAtual(novo.id), 3);

  await entrada.reload();
  assert.equal(entrada.produtoId, antigo.id);
});

// TESTE 7 - EXCLUIR ENTRADA
test('excluir entrada devolve estoque ao saldo anterior', async () => {
  const produto = await criarProduto(14);
  const entrada = await criarEntrada(produto, 4);

  await service.excluir(usuario.id, entrada.id);

  assert.equal(await estoqueAtual(produto.id), 10);

  const registro = await EntradaMercadoria.findByPk(entrada.id);
  assert.equal(registro, null);
});

// TESTE 8 - BLOQUEAR EXCLUSÃO
test('não exclui entrada quando estoque é insuficiente', async () => {
  const produto = await criarProduto(2);
  const entrada = await criarEntrada(produto, 4);

  await assert.rejects(
    service.excluir(usuario.id, entrada.id),
    erro(409)
  );

  assert.equal(await estoqueAtual(produto.id), 2);

  const registro = await EntradaMercadoria.findByPk(entrada.id);
  assert.ok(registro);
});

// TESTE 9 - BUSCAR ENTRADA INEXISTENTE
test('buscar entrada inexistente retorna 404', async () => {
  await assert.rejects(
    service.buscar(usuario.id, 999999999),
    erro(404)
  );
});

// TESTE 10 - VERIFICAR RELACIONAMENTOS
test('associações funcionam no banco real', async () => {
  const produto = await criarProduto(10);
  const entrada = await criarEntrada(produto, 4);

  const registro = await EntradaMercadoria.findOne({
    where: { id: entrada.id },
    include: [{ model: Produto, as: 'produto' }],
  });

  assert.ok(registro);
  assert.ok(registro.produto);
  assert.equal(registro.produto.id, produto.id);
  assert.equal(registro.produto.nome, 'Produto de Teste');
});
