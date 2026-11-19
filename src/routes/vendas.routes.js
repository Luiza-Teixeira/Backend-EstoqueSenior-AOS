import { Router } from 'express';
import * as c from '../controllers/vendas.controller.js';
import { autenticar } from '../middlewares/auth.js';

const r = Router();
r.use(autenticar);
r.get('/', c.listar);
r.post('/', c.criar);
r.get('/:id/itens', c.listarItens);
r.get('/:id', c.buscar);
r.put('/:id', c.atualizar);
r.delete('/:id', c.excluir);

export default r;