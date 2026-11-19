
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://teste:teste@localhost:5432/teste';
process.env.JWT_SECRET ||= 'chave_de_teste_para_unitarios_com_mais_de_32_caracteres';

const { EntradaMercadoria, Produto, sequelize } = await import('../src/models/index.js');
const service = await import('../src/services/entradas.service.js');
const { AppError } = await import('../src/utils/errors.js');

// Testes unitários com mocks: nenhuma conexão com o banco é necessária.
// Cada cenário usa mocks temporários e não deve rodar simultaneamente.
const usuarioId = 7;

const produto = (id, estoque) => ({
  id,
  usuarioId,
  quantidadeEstoque: estoque,

  async increment(campo, { by }) {
    this[campo] += by;
  },

  async decrement(campo, { by }) {
    this[campo] -= by;
  },

  async update(dados) {
    Object.assign(this, dados);
    return this;
  },
});


const entrada = (id, produtoId, quantidade) => ({
  id,
  usuarioId,
  produtoId,
  quantidade,
  custoUnitario: '5.00',
  fornecedor: 'Fornecedor Teste',
  observacao: 'Entrada de mercadoria para teste',

  // Data simulada de criação da entrada
  createdAt: new Date('2026-11-20T12:00:00Z'),
  updatedAt: new Date('2026-11-20T12:00:00Z'),

  async update(dados) {
    Object.assign(this, dados);
    return this;
  },

  async destroy() {
    this.excluida = true;
  },

  get({ plain } = {}) {
    return plain ? { ...this } : this;
  },

  toJSON() {
    return { ...this };
  },
});


async function executar(config, acao) {
  const restaurar = [];

  function substituir(obj, metodo, implementacao) {
    const original = obj[metodo];
    obj[metodo] = implementacao;
    restaurar.push(() => {
      obj[metodo] = original;
    });
  }

  const tx = {
    LOCK: { UPDATE: 'UPDATE' },
  };

  substituir(sequelize, 'transaction', async callback => callback(tx));

  for (const [obj, metodo, fn] of config) {
    substituir(obj, metodo, fn);
  }

  try {
    return await acao();
  } finally {
    for (const fn of restaurar.reverse()) {
      fn();
    }
  }
}

function erro(status) {
  return e => e instanceof AppError && e.status === status;
}

// Utiliza a formatação real da API.
const { entradaPublica } = await import('../src/utils/format.js');

const detalheMock = e => async ({ where }) => {
  if (where.id !== e.id) {
    return null;
  }

  const produtoAssociado = {
    id: e.produtoId,
    nome: 'Produto de Teste',
    precoVenda: '15.90',
    quantidadeEstoque: 10,
    estoqueMinimo: 2,
  };

  e.produto = produtoAssociado;

  return e;
};


// TESTE 1 - CADASTRAR ENTRADA

test('criar entrada aumenta estoque e registra a entrada', { concurrency: false }, async () => {
  const p = produto(1, 10);
  const e = entrada(20, 1, 4);

  const dados = {
    produtoId: 1,
    quantidade: 4,
    custoUnitario: 5,
  };

  let criado;

  const resultado = await executar([
    [Produto, 'findOne', async () => p],
    [EntradaMercadoria, 'create', async valores => {
      criado = valores;
      return e;
    }],
    [EntradaMercadoria, 'findOne', detalheMock(e)],
  ], () => service.criar(usuarioId, dados));

  assert.equal(p.quantidadeEstoque, 14);
  assert.equal(criado.usuarioId, usuarioId);
  assert.equal(criado.produtoId, 1);
  assert.deepEqual(resultado, entradaPublica(e));
});


// TESTE 2 - PRODUTO INEXISTENTE

test('não cria entrada para produto inexistente', { concurrency: false }, async () => {
  await executar([
    [Produto, 'findOne', async () => null],
  ], () =>
    assert.rejects(
      service.criar(usuarioId, {
        produtoId: 99,
        quantidade: 2,
      }),
      erro(404)
    )
  );
});


// TESTE 3 - EDITAR QUANTIDADE

test('editar quantidade do mesmo produto aplica somente a diferença', { concurrency: false }, async () => {
  const p = produto(1, 14);
  const e = entrada(20, 1, 4);

  await executar([
    [EntradaMercadoria, 'findOne', detalheMock(e)],
    [Produto, 'findAll', async () => [p]],
  ], () =>
    service.atualizar(usuarioId, 20, {
      quantidade: 6,
    })
  );

  assert.equal(p.quantidadeEstoque, 16);
  assert.equal(e.quantidade, 6);
});


// TESTE 4 - IMPEDIR ESTOQUE NEGATIVO

test('reduzir entrada ajusta estoque sem deixá-lo negativo', { concurrency: false }, async () => {
  const p = produto(1, 2);
  const e = entrada(20, 1, 4);

  await executar([
    [EntradaMercadoria, 'findOne', detalheMock(e)],
    [Produto, 'findAll', async () => [p]],
  ], async () => {
    await assert.rejects(
      service.atualizar(usuarioId, 20, {
        quantidade: 1,
      }),
      erro(409)
    );

    assert.equal(p.quantidadeEstoque, 2);
    assert.equal(e.quantidade, 4);
  });
});


// TESTE 5 - TRANSFERIR ENTRADA ENTRE PRODUTOS

test('transferir entrada reverte produto antigo e soma no novo', { concurrency: false }, async () => {
  const antigo = produto(1, 10);
  const novo = produto(2, 3);
  const e = entrada(20, 1, 4);

  await executar([
    [EntradaMercadoria, 'findOne', detalheMock(e)],
    [Produto, 'findAll', async () => [antigo, novo]],
  ], () =>
    service.atualizar(usuarioId, 20, {
      produtoId: 2,
      quantidade: 5,
    })
  );

  assert.equal(antigo.quantidadeEstoque, 6);
  assert.equal(novo.quantidadeEstoque, 8);
  assert.equal(e.produtoId, 2);
  assert.equal(e.quantidade, 5);
});


// TESTE 6 - TRANSFERÊNCIA SEM ESTOQUE SUFICIENTE

test('impede transferência sem estoque no produto antigo', { concurrency: false }, async () => {
  const antigo = produto(1, 2);
  const novo = produto(2, 3);
  const e = entrada(20, 1, 4);

  await executar([
    [EntradaMercadoria, 'findOne', detalheMock(e)],
    [Produto, 'findAll', async () => [antigo, novo]],
  ], async () => {
    await assert.rejects(
      service.atualizar(usuarioId, 20, {
        produtoId: 2,
      }),
      erro(409)
    );

    assert.equal(antigo.quantidadeEstoque, 2);
    assert.equal(novo.quantidadeEstoque, 3);
  });
});


// TESTE 7 - EXCLUIR ENTRADA

test('excluir entrada devolve estoque ao saldo anterior', { concurrency: false }, async () => {
  const p = produto(1, 14);
  const e = entrada(20, 1, 4);

  await executar([
    [EntradaMercadoria, 'findOne', detalheMock(e)],
    [Produto, 'findOne', async () => p],
  ], () =>
    service.excluir(usuarioId, 20)
  );

  assert.equal(p.quantidadeEstoque, 10);
  assert.equal(e.excluida, true);
});


// TESTE 8 - BLOQUEAR EXCLUSÃO SEM ESTOQUE

test('não exclui entrada quando o saldo é insuficiente', { concurrency: false }, async () => {
  const p = produto(1, 2);
  const e = entrada(20, 1, 4);

  await executar([
    [EntradaMercadoria, 'findOne', detalheMock(e)],
    [Produto, 'findOne', async () => p],
  ], async () => {
    await assert.rejects(
      service.excluir(usuarioId, 20),
      erro(409)
    );

    assert.equal(p.quantidadeEstoque, 2);
    assert.equal(e.excluida, undefined);
  });
});


// TESTE 9 - BUSCAR ENTRADA INEXISTENTE

test('buscar entrada inexistente retorna 404', { concurrency: false }, async () => {
  await executar([
    [EntradaMercadoria, 'findOne', async () => null],
  ], () =>
    assert.rejects(
      service.buscar(usuarioId, 999),
      erro(404)
    )
  );
});


// TESTE 10 - VERIFICAR RELACIONAMENTOS

test('associações de entrada estão configuradas', () => {
  assert.equal(
    EntradaMercadoria.associations.produto.target,
    Produto
  );

  assert.equal(
    Produto.associations.entradas.target,
    EntradaMercadoria
  );

  assert.equal(
    EntradaMercadoria.associations.produto.foreignKey,
    'produtoId'
  );
});
