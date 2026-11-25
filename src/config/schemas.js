import { z } from 'zod';
const texto = (min = 1, max = 140) => z.string().trim().min(min).max(max);
const dinheiro = z.number().finite().nonnegative().max(1_000_000);
const inteiro = z.number().int().nonnegative();
const optTexto = (max = 140) => z.string().trim().max(max).optional();
const numeroId = z.number().int().positive();

export const cadastroSchema = z.object({
  nome: texto(3, 120), email: z.email().max(255), senha: z.string().min(8).max(128),
}).strict();
export const loginSchema = z.object({ email: z.email(), senha: z.string().min(1) }).strict();
export const perfilSchema = z.object({
  nome: texto(3, 120), email: z.email().max(255), novaSenha: z.string().min(8).max(128).optional(),
}).strict();
export const produtoCriarSchema = z.object({
  nome: texto(1, 140), precoVenda: dinheiro, quantidadeEstoque: inteiro,
  estoqueMinimo: inteiro, categoria: optTexto(80), descricao: optTexto(5000),
}).strict();
export const produtoAtualizarSchema = produtoCriarSchema.omit({ quantidadeEstoque: true }).partial().strict().refine(
  (o) => Object.keys(o).length > 0, 'Informe algum campo para atualizar.'
);
export const entradaCriarSchema = z.object({
  produtoId: numeroId, quantidade: z.number().int().positive(),
  custoUnitario: dinheiro, fornecedor: optTexto(140), observacao: optTexto(5000),
}).strict();
export const entradaAtualizarSchema = entradaCriarSchema.partial().strict().refine(
  (o) => Object.keys(o).length > 0, 'Informe algum campo para atualizar.'
);
export const vendaCriarSchema = z.object({
  itens: z.array(z.object({ produtoId: numeroId, quantidade: z.number().int().positive() }).strict()).min(1).max(100),
  formaPagamento: z.enum(['DINHEIRO', 'PIX', 'CARTAO']), cliente: optTexto(140),
}).strict();
export const vendaAtualizarSchema = vendaCriarSchema.partial().strict().refine(
  (o) => Object.keys(o).length > 0, 'Informe algum campo para atualizar.'
);
