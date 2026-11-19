import { AppError } from '../utils/errors.js';
export function notFound(req, res, next) {
  next(new AppError(404, `Rota ${req.path} não encontrada.`));
}
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err instanceof AppError ? err.status : 500;
  let mensagem = err instanceof AppError ? err.message : 'Erro interno do servidor.';
  let detalhes = err instanceof AppError ? err.detalhes : [];
  if (err.name === 'SequelizeUniqueConstraintError') { status = 409; mensagem = 'Já existe um registro com esses dados.'; }
  if (err.name === 'SequelizeForeignKeyConstraintError') { status = 409; mensagem = 'Registro referenciado por outro recurso.'; }
  if (err.name === 'SequelizeValidationError') { status = 400; mensagem = 'Dados inválidos para o banco.'; detalhes = err.errors?.map((e) => e.message) || []; }
  if (err.name === 'SequelizeDatabaseError' && err.parent?.code === '22P02') { status = 400; mensagem = 'Identificador inválido.'; }
  if (status >= 500) console.error(err);
  return res.status(status).json({
    timestamp: new Date().toISOString(), status,
    erro: status >= 500 ? 'Internal Server Error' : 'Requisição rejeitada',
    mensagem, caminho: req.path, detalhes,
  });
}
