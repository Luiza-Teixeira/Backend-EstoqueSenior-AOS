export class AppError extends Error {
  constructor(status, mensagem, detalhes = []) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}
export const exigir = (condicao, status, mensagem) => {
  if (!condicao) throw new AppError(status, mensagem);
};
export const validarId = (valor) => {
  const n = Number(valor);
  if (!Number.isSafeInteger(n) || n < 1) throw new AppError(400, 'Identificador inválido.');
  return n;
};
export function validar(schema, entrada) {
  const r = schema.safeParse(entrada);
  if (!r.success) {
    throw new AppError(400, 'Dados inválidos.', r.error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`));
  }
  return r.data;
}
