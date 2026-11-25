import * as service from "../services/produtos.service.js";

import {
  produtoCriarSchema,
  produtoAtualizarSchema,
} from "../validators/produtos.schema.js";

import { validar, validarId } from "../utils/errors.js";

// GET /produtos
export const listar = async (req, res) => {
  return res.json(await service.listar(req.usuario.id));
};

// GET /produtos/:id
export const buscar = async (req, res) => {
  return res.json(
    await service.buscar(req.usuario.id, validarId(req.params.id)),
  );
};

// POST /produtos
export const criar = async (req, res) => {
  const dados = validar(produtoCriarSchema, req.body);

  const produto = await service.criar(req.usuario.id, dados);

  return res.status(201).json(produto);
};

// PUT /produtos/:id
export const atualizar = async (req, res) => {
  const dados = validar(produtoAtualizarSchema, req.body);

  const produto = await service.atualizar(
    req.usuario.id,
    validarId(req.params.id),
    dados,
  );

  return res.json(produto);
};

// DELETE /produtos/:id
export const excluir = async (req, res) => {
  await service.excluir(req.usuario.id, validarId(req.params.id));

  return res.status(204).end();
};
