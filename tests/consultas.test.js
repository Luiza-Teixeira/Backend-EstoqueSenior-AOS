import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://teste:teste@localhost:5432/teste';
process.env.JWT_SECRET ||= 'chave_de_teste_para_unitarios_com_mais_de_32_caracteres';

const { Produto, EntradaMercadoria, Venda } = await import('../src/models/index.js');
const acompanhamento = await import('../src/services/acompanhamento.service.js');
const { AppError } = await import('../src/utils/errors.js');

test('lista estoque apenas do usuário e identifica produtos no limite mínimo', async (t) => {
  const produtos = [
    { id: 1, nome: 'Arroz', quantidadeEstoque: 2, estoqueMinimo: 2 },
    { id: 2, nome: 'Feijão', quantidadeEstoque: 8, estoqueMinimo: 2 },
  ];
  let consulta;
  t.mock.method(Produto, 'findAll', async (opcoes) => {
    consulta = opcoes;
    return produtos;
  });

  assert.deepEqual(await acompanhamento.estoque(7), [
    { produtoId: 1, nomeProduto: 'Arroz', quantidadeEstoque: 2, estoqueMinimo: 2, estoqueBaixo: true },
    { produtoId: 2, nomeProduto: 'Feijão', quantidadeEstoque: 8, estoqueMinimo: 2, estoqueBaixo: false },
  ]);
  assert.equal(consulta.where.usuarioId, 7);
  assert.deepEqual(consulta.order, [['nome', 'ASC']]);

  assert.deepEqual(await acompanhamento.estoqueBaixo(7), [
    { produtoId: 1, nomeProduto: 'Arroz', quantidadeEstoque: 2, estoqueMinimo: 2, estoqueBaixo: true },
  ]);
});

test('calcula o resumo do dashboard com quantidades e valores corretos por usuário', async (t) => {
  let consultaProdutos;
  let consultaVendas;
  t.mock.method(Produto, 'findAll', async (opcoes) => {
    consultaProdutos = opcoes;
    return [
      { quantidadeEstoque: 0, estoqueMinimo: 2 },
      { quantidadeEstoque: 2, estoqueMinimo: 2 },
      { quantidadeEstoque: 7, estoqueMinimo: 2 },
    ];
  });
  t.mock.method(Venda, 'findAll', async (opcoes) => {
    consultaVendas = opcoes;
    return [{ total: '10.10' }, { total: '20.20' }];
  });

  assert.deepEqual(await acompanhamento.resumo(9), {
    totalProdutosCadastrados: 3,
    quantidadeProdutosEstoqueBaixo: 2,
    quantidadeProdutosSemEstoque: 1,
    quantidadeVendasDia: 2,
    valorTotalVendidoDia: 30.3,
  });
  assert.equal(consultaProdutos.where.usuarioId, 9);
  assert.equal(consultaVendas.where.usuarioId, 9);
  assert.ok(Object.getOwnPropertySymbols(consultaVendas.where.createdAt).length > 0);
});

test('combina entradas e itens vendidos no histórico em ordem cronológica decrescente', async (t) => {
  const maisAntiga = new Date('2026-01-01T10:00:00.000Z');
  const maisRecente = new Date('2026-01-02T10:00:00.000Z');
  let consultaEntrada;
  let consultaVenda;
  t.mock.method(EntradaMercadoria, 'findAll', async (opcoes) => {
    consultaEntrada = opcoes;
    return [{
      id: 11,
      produtoId: 3,
      quantidade: 5,
      custoUnitario: '4.25',
      createdAt: maisAntiga,
      produto: { nome: 'Café' },
    }];
  });
  t.mock.method(Venda, 'findAll', async (opcoes) => {
    consultaVenda = opcoes;
    return [{
      id: 20,
      createdAt: maisRecente,
      itens: [{
        id: 21,
        produtoId: 3,
        nomeProduto: 'Café',
        quantidade: 2,
        valorUnitario: '6.50',
      }],
    }];
  });

  assert.deepEqual(await acompanhamento.historico(12), [
    {
      id: 'saida-21',
      tipo: 'SAIDA',
      referenciaId: 20,
      produtoId: 3,
      nomeProduto: 'Café',
      quantidade: 2,
      valorUnitario: 6.5,
      dataHora: maisRecente.toISOString(),
    },
    {
      id: 'entrada-11',
      tipo: 'ENTRADA',
      referenciaId: 11,
      produtoId: 3,
      nomeProduto: 'Café',
      quantidade: 5,
      valorUnitario: 4.25,
      dataHora: maisAntiga.toISOString(),
    },
  ]);
  assert.equal(consultaEntrada.where.usuarioId, 12);
  assert.equal(consultaVenda.where.usuarioId, 12);
  assert.equal(consultaEntrada.include[0].as, 'produto');
  assert.equal(consultaVenda.include[0].as, 'itens');
});

test('busca movimentação pelo identificador ou retorna 404', async (t) => {
  const historico = [{
    id: 'entrada-11',
    tipo: 'ENTRADA',
    referenciaId: 11,
    produtoId: 3,
    nomeProduto: 'Café',
    quantidade: 5,
    valorUnitario: 4.25,
    dataHora: '2026-01-01T10:00:00.000Z',
  }];
  t.mock.method(EntradaMercadoria, 'findAll', async () => [{
    id: 11,
    produtoId: 3,
    quantidade: 5,
    custoUnitario: '4.25',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    produto: { nome: 'Café' },
  }]);
  t.mock.method(Venda, 'findAll', async () => []);

  assert.deepEqual(await acompanhamento.movimentacao(12, 'entrada-11'), historico[0]);
  await assert.rejects(
    acompanhamento.movimentacao(12, 'entrada-999'),
    (erro) => erro instanceof AppError && erro.status === 404
  );
});
