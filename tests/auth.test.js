import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Dados fictícios: os testes usam mocks e não acessam o banco PostgreSQL.
process.env.DATABASE_URL = 'postgresql://teste:teste@127.0.0.1:5432/estoque_teste';
process.env.JWT_SECRET = 'chave_de_teste_local_sem_uso_em_producao_123456';

const { cadastroSchema, loginSchema, perfilSchema } = await import('../src/config/schemas.js');
const { validar, AppError } = await import('../src/utils/errors.js');
const { Usuario, Sessao, sequelize } = await import('../src/models/index.js');
const { cadastrar, login, encerrarSessao, TOKEN_DIAS } = await import('../src/services/auth.service.js');
const { autenticar } = await import('../src/middlewares/auth.js');
const env = (await import('../src/config/env.js')).default;

const criarToken = (usuarioId = 7) => jwt.sign({}, env.JWT_SECRET, {
  algorithm: 'HS256',
  subject: String(usuarioId),
  jwtid: randomUUID(),
  expiresIn: '1h',
  issuer: 'estoque-senior',
  audience: 'estoque-senior-mobile',
});

const verificarToken = (token) => jwt.verify(token, env.JWT_SECRET, {
  algorithms: ['HS256'],
  issuer: 'estoque-senior',
  audience: 'estoque-senior-mobile',
});

test('cadastro valida nome, e-mail e senha com no mínimo 8 caracteres', () => {
  const dados = validar(cadastroSchema, {
    nome: '  Pessoa Teste  ', email: 'pessoa@example.com', senha: 'Senha12345',
  });
  assert.equal(dados.nome, 'Pessoa Teste');
  assert.throws(() => validar(cadastroSchema, {
    nome: 'Pessoa Teste', email: 'pessoa@example.com', senha: '123',
  }), (erro) => erro instanceof AppError && erro.status === 400);
});

test('login rejeita e-mail inválido e campos extras', () => {
  assert.throws(() => validar(loginSchema, {
    email: 'email-incorreto', senha: 'teste',
  }), (erro) => erro instanceof AppError && erro.status === 400);
  assert.throws(() => validar(loginSchema, {
    email: 'pessoa@example.com', senha: 'teste', admin: true,
  }), (erro) => erro instanceof AppError && erro.status === 400);
});

test('perfil mantém o formato de atualização esperado pelo aplicativo', () => {
  const perfil = validar(perfilSchema, {
    nome: 'Pessoa Teste', email: 'pessoa@example.com', novaSenha: 'SenhaNova123',
  });
  assert.equal(perfil.novaSenha, 'SenhaNova123');
});

test('cadastro cria senha com hash, normaliza e-mail e emite sessão JWT', async (t) => {
  let registro;
  let sessaoCriada;
  const transacao = {};
  t.mock.method(sequelize, 'transaction', async (executar) => executar(transacao));
  t.mock.method(Usuario, 'findOne', async () => null);
  t.mock.method(Usuario, 'create', async (dados, opcoes) => {
    assert.equal(opcoes.transaction, transacao);
    registro = dados;
    return { id: 7, ...dados };
  });
  t.mock.method(Sessao, 'create', async (dados, opcoes) => {
    assert.equal(opcoes.transaction, transacao);
    sessaoCriada = dados;
  });

  const resposta = await cadastrar({
    nome: 'Pessoa Teste', email: ' PESSOA@EXAMPLE.COM ', senha: 'Senha12345',
  });
  assert.equal(registro.email, 'pessoa@example.com');
  assert.equal(await bcrypt.compare('Senha12345', registro.senhaHash), true);
  assert.equal(resposta.usuario.email, 'pessoa@example.com');
  assert.equal('senhaHash' in resposta.usuario, false);
  const payload = verificarToken(resposta.token);
  assert.equal(payload.sub, '7');
  assert.equal(payload.jti, sessaoCriada.jti);
  assert.equal(payload.exp - payload.iat, TOKEN_DIAS * 86400);
});

test('cadastro não permite e-mail já cadastrado', async (t) => {
  t.mock.method(sequelize, 'transaction', async (executar) => executar({}));
  t.mock.method(Usuario, 'findOne', async () => ({ id: 10 }));
  await assert.rejects(() => cadastrar({
    nome: 'Outra Pessoa', email: 'pessoa@example.com', senha: 'Senha12345',
  }), (erro) => erro instanceof AppError && erro.status === 409);
});

test('login aceita senha correta e registra a sessão', async (t) => {
  const senhaHash = await bcrypt.hash('Senha12345', 4);
  t.mock.method(Usuario, 'findOne', async () => ({
    id: 7, nome: 'Pessoa Teste', email: 'pessoa@example.com', senhaHash,
  }));
  let sessao;
  t.mock.method(Sessao, 'create', async (dados) => { sessao = dados; });
  const resposta = await login({ email: ' PESSOA@EXAMPLE.COM ', senha: 'Senha12345' });
  assert.equal(resposta.usuario.id, 7);
  assert.equal(verificarToken(resposta.token).jti, sessao.jti);
});

test('login rejeita senha incorreta', async (t) => {
  const senhaHash = await bcrypt.hash('Senha12345', 4);
  t.mock.method(Usuario, 'findOne', async () => ({ senhaHash }));
  await assert.rejects(() => login({ email: 'pessoa@example.com', senha: 'errada' }),
    (erro) => erro instanceof AppError && erro.status === 401);
});

test('logout marca a sessão como revogada', async () => {
  let atualizacao;
  await encerrarSessao({ update: async (dados) => { atualizacao = dados; } });
  assert.ok(atualizacao.revogadaEm instanceof Date);
});

test('middleware bloqueia requisições sem token', async () => {
  let erro;
  await autenticar({ get: () => undefined }, {}, (resultado) => { erro = resultado; });
  assert.ok(erro instanceof AppError);
  assert.equal(erro.status, 401);
});

test('middleware autentica usuário com sessão válida', async (t) => {
  const token = criarToken();
  const usuario = { id: 7, nome: 'Pessoa Teste' };
  const sessao = { expiraEm: new Date(Date.now() + 3600_000) };
  t.mock.method(Sessao, 'findOne', async () => sessao);
  t.mock.method(Usuario, 'findByPk', async () => usuario);
  const req = { get: () => `Bearer ${token}` };
  let proximo = false;
  await autenticar(req, {}, (erro) => {
    assert.equal(erro, undefined);
    proximo = true;
  });
  assert.equal(proximo, true);
  assert.equal(req.usuario, usuario);
  assert.equal(req.sessao, sessao);
});

test('middleware rejeita token cuja sessão foi revogada', async (t) => {
  t.mock.method(Sessao, 'findOne', async () => null);
  const req = { get: () => `Bearer ${criarToken()}` };
  let erro;
  await autenticar(req, {}, (resultado) => { erro = resultado; });
  assert.ok(erro instanceof AppError);
  assert.equal(erro.status, 401);
});

test('middleware rejeita token JWT inválido', async () => {
  const req = { get: () => 'Bearer isto-nao-e-um-jwt' };
  let erro;
  await autenticar(req, {}, (resultado) => { erro = resultado; });
  assert.ok(erro instanceof AppError);
  assert.equal(erro.status, 401);
});
