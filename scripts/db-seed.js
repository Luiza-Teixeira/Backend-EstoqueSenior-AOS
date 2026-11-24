import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sequelize, Usuario } from '../src/models/index.js';
import * as produtos from '../src/services/produtos.service.js';
import * as entradas from '../src/services/entradas.service.js';
import * as vendas from '../src/services/vendas.service.js';
import { emitirSessao } from '../src/services/auth.service.js';

const usuarios = [1, 2].map((n) => ({
  nome: `Usuário Demonstrativo ${n}`,
  email: process.env[`DEMO_EMAIL_${n}`]?.trim().toLowerCase(),
  senha: process.env[`DEMO_PASSWORD_${n}`],
}));
if (usuarios.some((u) => !u.email || !u.senha || u.senha.length < 8)) {
  console.error('Configure DEMO_EMAIL_1/2 e DEMO_PASSWORD_1/2 no .env, com senhas de teste de pelo menos 8 caracteres.');
  process.exit(1);
}
try {
  await sequelize.authenticate();
  for (const usuarioBase of usuarios) {
    let usuario = await Usuario.findOne({ where: { email: usuarioBase.email } });
    if (usuario) { console.log(`Conta já existente: ${usuarioBase.email} (sem duplicar dados).`); continue; }
    usuario = await Usuario.create({
      nome: usuarioBase.nome, email: usuarioBase.email,
      senhaHash: await bcrypt.hash(usuarioBase.senha, 12),
    });
    await emitirSessao(usuario);
    const p1 = await produtos.criar(usuario.id, { nome: 'Café 500g', precoVenda: 15.9, quantidadeEstoque: 0, estoqueMinimo: 5, categoria: 'Alimentos' });
    const p2 = await produtos.criar(usuario.id, { nome: 'Leite 1L', precoVenda: 6.5, quantidadeEstoque: 0, estoqueMinimo: 4, categoria: 'Laticínios' });
    await entradas.criar(usuario.id, { produtoId: p1.id, quantidade: 16, custoUnitario: 9.3, fornecedor: 'Fornecedor A' });
    await entradas.criar(usuario.id, { produtoId: p2.id, quantidade: 12, custoUnitario: 4.1, fornecedor: 'Fornecedor B' });
    await vendas.criar(usuario.id, { itens: [{ produtoId: p1.id, quantidade: 1 }, { produtoId: p2.id, quantidade: 2 }], formaPagamento: 'PIX', cliente: 'Cliente teste A' });
    await vendas.criar(usuario.id, { itens: [{ produtoId: p1.id, quantidade: 2 }, { produtoId: p2.id, quantidade: 1 }], formaPagamento: 'DINHEIRO', cliente: 'Cliente teste B' });
    console.log(`Dados de demonstração criados para ${usuarioBase.email}.`);
  }
  console.log('Seed encerrado. Conferir tabela no Neon e executar a coleção Postman.');
} catch (error) {
  console.error('Falha no seed:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}