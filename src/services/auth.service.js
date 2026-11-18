import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { Usuario, Sessao, sequelize } from '../models/index.js';
import env from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { usuarioPublico } from '../utils/format.js';

export const TOKEN_DIAS = 7;
export async function emitirSessao(usuario, transaction) {
  const jti = randomUUID();
  const token = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256', subject: String(usuario.id), jwtid: jti,
    expiresIn: `${TOKEN_DIAS}d`, issuer: 'estoque-senior', audience: 'estoque-senior-mobile',
  });
  await Sessao.create({ jti, usuarioId: usuario.id, expiraEm: new Date(Date.now() + TOKEN_DIAS * 86400_000) }, { transaction });
  return { usuario: usuarioPublico(usuario), token };
}
export async function cadastrar({ nome, email, senha }) {
  const normalizado = email.trim().toLowerCase();
  return sequelize.transaction(async (transaction) => {
    const existe = await Usuario.findOne({ where: { email: normalizado }, transaction });
    if (existe) throw new AppError(409, 'E-mail já cadastrado.');
    const senhaHash = await bcrypt.hash(senha, 12);
    const usuario = await Usuario.create({ nome: nome.trim(), email: normalizado, senhaHash }, { transaction });
    return emitirSessao(usuario, transaction);
  });
}
export async function login({ email, senha }) {
  const usuario = await Usuario.findOne({ where: { email: email.trim().toLowerCase() } });
  if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
    throw new AppError(401, 'E-mail ou senha incorretos.');
  }
  return emitirSessao(usuario);
}
export async function encerrarSessao(sessao) {
  await sessao.update({ revogadaEm: new Date() });
}
