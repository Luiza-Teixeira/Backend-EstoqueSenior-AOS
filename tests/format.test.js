import test from 'node:test';
import assert from 'node:assert/strict';
import { centavos, reais, usuarioPublico, produtoPublico, entradaPublica, vendaPublica } from '../src/utils/format.js';
import { validarId, AppError } from '../src/utils/errors.js';

const data = new Date('2026-11-13T12:00:00Z');
test('valores monetários usam centavos para evitar imprecisão comum', () => {
  assert.equal(centavos(12.90), 1290);
  assert.equal(reais(1290), 12.9);
  assert.equal(centavos('3.45'), 345);
});
test('resposta do usuário não vaza senhaHash', () => {
  const usuario = usuarioPublico({ id: 7, nome: 'Teste', email: 'teste@example.com', senhaHash: 'HASH' });
  assert.deepEqual(usuario, { id: 7, nome: 'Teste', email: 'teste@example.com' });
  assert.equal(Object.hasOwn(usuario, 'senhaHash'), false);
});
test('produto converte DECIMAL do Sequelize em número para o mobile', () => {
  const p = produtoPublico({ id: 2, nome: 'Leite', precoVenda: '6.50', quantidadeEstoque: 5, estoqueMinimo: 2, categoria: 'Laticínios', descricao: null });
  assert.equal(p.precoVenda, 6.5);
  assert.equal(p.descricao, undefined);
});
test('entrada contém produto vinculado e dataHora ISO', () => {
  const e = entradaPublica({ id: 4, produto: { id: 2, nome: 'Leite' }, quantidade: 3, custoUnitario: '2.20', createdAt: data });
  assert.equal(e.produto.id, 2);
  assert.equal(e.custoUnitario, 2.2);
  assert.equal(e.dataHora, data.toISOString());
});
test('venda contém itens e total numericamente compatíveis com o frontend', () => {
  const v = vendaPublica({ id: 1, total: '12.30', formaPagamento: 'PIX', itens: [{ produtoId: 3, nomeProduto: 'Pão', quantidade: 2, valorUnitario: '6.15' }], createdAt: data });
  assert.equal(v.total, 12.3);
  assert.equal(v.itens[0].valorUnitario, 6.15);
});
test('IDs devem ser inteiros positivos', () => {
  assert.equal(validarId('123'), 123);
  for (const invalido of ['abc', '0', '-1', '1.2', 'Infinity']) assert.throws(() => validarId(invalido), AppError);
});
