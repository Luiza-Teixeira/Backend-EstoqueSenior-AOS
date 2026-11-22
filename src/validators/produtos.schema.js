import { z } from "zod";

export const produtoCriarSchema = z.strictObject({
  nome: z
    .string()
    .trim()
    .min(1, "O nome é obrigatório.")
    .max(140, "O nome deve ter no máximo 140 caracteres."),

  precoVenda: z.number().finite().positive("O preço deve ser maior que zero."),

  quantidadeEstoque: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .nonnegative("A quantidade não pode ser negativa.")
    .default(0),

  estoqueMinimo: z
    .number()
    .int("O estoque mínimo deve ser um número inteiro.")
    .nonnegative("O estoque mínimo não pode ser negativo.")
    .default(0),

  categoria: z
    .string()
    .trim()
    .max(80, "A categoria deve ter no máximo 80 caracteres.")
    .nullable()
    .optional(),

  descricao: z.string().trim().nullable().optional(),
});

export const produtoAtualizarSchema = z
  .strictObject({
    nome: z
      .string()
      .trim()
      .min(1, "O nome é obrigatório.")
      .max(140, "O nome deve ter no máximo 140 caracteres.")
      .optional(),

    precoVenda: z
      .number()
      .finite()
      .positive("O preço deve ser maior que zero.")
      .optional(),

    estoqueMinimo: z
      .number()
      .int("O estoque mínimo deve ser um número inteiro.")
      .nonnegative("O estoque mínimo não pode ser negativo.")
      .optional(),

    categoria: z
      .string()
      .trim()
      .max(80, "A categoria deve ter no máximo 80 caracteres.")
      .nullable()
      .optional(),

    descricao: z.string().trim().nullable().optional(),
  })
  .refine(
    (dados) => Object.keys(dados).length > 0,
    "Informe pelo menos um campo para atualizar.",
  );
