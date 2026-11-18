import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { Usuario, Sessao } from '../models/index.js';
import { AppError } from '../utils/errors.js';
export async function autenticar(req, res, next) {
  try {
    const header = req.get('Authorization') || '';
    const match = /^Bearer (\S+)$/i.exec(header);
    if (!match) throw new AppError(401, 'Faça login para acessar este recurso.');
    const payload = jwt.verify(match[1], env.JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'estoque-senior', audience: 'estoque-senior-mobile',
    });
    if (!payload.jti || !/^\d+$/.test(payload.sub || '')) throw new AppError(401, 'Sessão inválida.');
    const sessao = await Sessao.findOne({ where: { jti: payload.jti, usuarioId: Number(payload.sub), revogadaEm: null } });
    if (!sessao || sessao.expiraEm <= new Date()) throw new AppError(401, 'Sessão expirada ou encerrada.');
    const usuario = await Usuario.findByPk(Number(payload.sub));
    if (!usuario) throw new AppError(401, 'Usuário da sessão não encontrado.');
    req.usuario = usuario;
    req.sessao = sessao;
    next();
  } catch (e) {
    if (e instanceof AppError) return next(e);
    if (['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(e.name)) {
      return next(new AppError(401, 'Token inválido ou expirado. Faça login novamente.'));
    }
    next(e);
  }
}
