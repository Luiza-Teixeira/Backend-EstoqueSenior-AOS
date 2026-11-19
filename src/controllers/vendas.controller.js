import * as service from '../services/vendas.service.js';
import { vendaCriarSchema, vendaAtualizarSchema } from '../config/schemas.js';
import { validar, validarId } from '../utils/errors.js';

export const listar = async (req, res) => res.json(await service.listar(req.usuario.id));
export const buscar = async (req, res) => res.json(await service.buscar(req.usuario.id, validarId(req.params.id)));
export const listarItens = async (req, res) => res.json(await service.listarItens(req.usuario.id, validarId(req.params.id)));
export const criar = async (req, res) => res.status(201).json(await service.criar(req.usuario.id, validar(vendaCriarSchema, req.body)));
export const atualizar = async (req, res) => res.json(await service.atualizar(req.usuario.id, validarId(req.params.id), validar(vendaAtualizarSchema, req.body)));
export const excluir = async (req, res) => {
  await service.excluir(req.usuario.id, validarId(req.params.id));
  return res.status(204).end();
};