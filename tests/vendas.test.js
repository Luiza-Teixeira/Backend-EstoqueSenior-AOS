import test from 'node:test';
import assert from 'node:assert/strict';
import { vendaCriarSchema, vendaAtualizarSchema } from '../src/config/schemas.js';
import { AppError, validar } from '../src/utils/errors.js';

process.env.DATABASE_URL ||= 'postgresql://teste:teste@localhost:5432/teste';
process.env.JWT_SECRET ||= 'chave_de_teste_para_unitarios_com_mais_de_32_caracteres';

const { calcularMovimentacaoVenda } = await import('../src/services/vendas.service.js');

const produtosBase = () => [
  { id: 1, nome: 'Café 500g', precoVenda: '15.90', quantidadeEstoque: 10 },
  { id: 2, nome: 'Leite 1L', precoVenda: '6.50', quantidadeEstoque: 5 },
];

test('schema de criação aceita venda válida e rejeita dados inválidos', () => {
  const valida = validar(vendaCriarSchema, {
    itens: [{ produtoId: 1, quantidade: 2 }],
    formaPagamento: 'PIX',
    cliente: 'Maria',
  });
  assert.equal(valida.formaPagamento, 'PIX');
  assert.equal(valida.itens.length, 1);

  assert.throws(
    () => validar(vendaCriarSchema, { itens: [], formaPagamento: 'PIX' }),
    (err) => err instanceof AppError && err.status === 400
  );

  assert.throws(
    () => validar(vendaCriarSchema, { itens: [{ produtoId: 1, quantidade: 0 }], formaPagamento: 'PIX' }),
    (err) => err instanceof AppError && err.status === 400
  );

  assert.throws(
    () => validar(vendaCriarSchema, { itens: [{ produtoId: 1, quantidade: 1 }], formaPagamento: 'BOLETO' }),
    (err) => err instanceof AppError && err.status === 400
  );
});

test('schema de atualização exige ao menos um campo', () => {
  assert.throws(
    () => validar(vendaAtualizarSchema, {}),
    (err) => err instanceof AppError && err.status === 400
  );

  const ok = validar(vendaAtualizarSchema, { formaPagamento: 'CARTAO' });
  assert.equal(ok.formaPagamento, 'CARTAO');
});

test('calcula corretamente o valor total e realiza a baixa de estoque', () => {
  const { total, linhas, saldos } = calcularMovimentacaoVenda(produtosBase(), [
    { produtoId: 1, quantidade: 2 },
    { produtoId: 2, quantidade: 3 },
  ]);

  assert.equal(total, 51.3);
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas[0], {
    produtoId: 1,
    quantidade: 2,
    valorUnitario: 15.9,
    nomeProduto: 'Café 500g',
  });
  assert.equal(saldos.get(1), 8);
  assert.equal(saldos.get(2), 2);
});

test('bloqueia venda acima da quantidade disponível em estoque', () => {
  assert.throws(
    () => calcularMovimentacaoVenda(produtosBase(), [{ produtoId: 2, quantidade: 6 }]),
    (err) => err instanceof AppError && err.status === 409 && err.message.includes('Estoque insuficiente')
  );
});

test('bloqueia produto repetido na mesma venda', () => {
  assert.throws(
    () => calcularMovimentacaoVenda(produtosBase(), [
      { produtoId: 1, quantidade: 1 },
      { produtoId: 1, quantidade: 2 },
    ]),
    (err) => err instanceof AppError && err.status === 400
  );
});

test('na edição de venda, estorna itens anteriores antes de aplicar a nova baixa', () => {
  const produtos = [{ id: 1, nome: 'Café 500g', precoVenda: '15.90', quantidadeEstoque: 2 }];
  const existentes = [{ produtoId: 1, quantidade: 4 }];
  const novosItens = [{ produtoId: 1, quantidade: 5 }];

  const { total, saldos } = calcularMovimentacaoVenda(produtos, novosItens, existentes);
  assert.equal(total, 79.5);
  assert.equal(saldos.get(1), 1); // 2 atuais + 4 estornados - 5 novos = 1
});