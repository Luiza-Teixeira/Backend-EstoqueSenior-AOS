import bcrypt from 'bcryptjs';
import { Usuario, sequelize, ItemVenda, Venda, EntradaMercadoria, Produto, Sessao } from '../models/index.js';
import { cadastroSchema, loginSchema, perfilSchema } from '../config/schemas.js';
import { validar, AppError } from '../utils/errors.js';
import { usuarioPublico } from '../utils/format.js';
import * as auth from '../services/auth.service.js';
export const cadastrar = async (req, res) => res.status(201).json(await auth.cadastrar(validar(cadastroSchema, req.body)));
export const login = async (req, res) => res.json(await auth.login(validar(loginSchema, req.body)));
export const logout = async (req, res) => { await auth.encerrarSessao(req.sessao); return res.status(204).end(); };
export const me = async (req, res) => res.json(usuarioPublico(req.usuario));
export const atualizarPerfil = async (req, res) => {
  const dados = validar(perfilSchema, req.body);
  const email = dados.email.trim().toLowerCase();
  if (email !== req.usuario.email && await Usuario.findOne({ where: { email } })) throw new AppError(409, 'E-mail já cadastrado.');
  const valores = { nome: dados.nome, email };
  if (dados.novaSenha) {
    valores.senhaHash = await bcrypt.hash(dados.novaSenha, 12);
  }
  await req.usuario.update(valores);
  return res.json(usuarioPublico(req.usuario));
};

export const excluirConta = async (req, res) => {
  const usuarioId = req.usuario.id;
  await sequelize.transaction(async (transaction) => {
    const vendas = await Venda.findAll({ attributes: ['id'], where: { usuarioId }, transaction });
    if (vendas.length) await ItemVenda.destroy({ where: { vendaId: vendas.map((v) => v.id) }, transaction });
    await Venda.destroy({ where: { usuarioId }, transaction });
    await EntradaMercadoria.destroy({ where: { usuarioId }, transaction });
    await Produto.destroy({ where: { usuarioId }, transaction });
    await Sessao.destroy({ where: { usuarioId }, transaction });
    await Usuario.destroy({ where: { id: usuarioId }, transaction });
  });
  return res.status(204).end();
};
