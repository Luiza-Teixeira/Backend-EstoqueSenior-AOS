import { Router } from "express";
import * as c from "../controllers/produtos.controller.js";
import { autenticar } from "../middlewares/auth.js";

const r = Router();

// Todas as rotas exigem autenticação JWT
r.use(autenticar);

// Listar e cadastrar produtos
r.get("/", c.listar);
r.post("/", c.criar);

// Consultar, atualizar e excluir produto
r.get("/:id", c.buscar);
r.put("/:id", c.atualizar);
r.delete("/:id", c.excluir);

export default r;
