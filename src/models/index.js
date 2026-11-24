import { Sequelize, DataTypes } from 'sequelize';
import pg from 'pg';
import env from '../config/env.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres', dialectModule: pg, logging: false,
  pool: { max: 5, min: 0, acquire: 20000, idle: 10000 },
});

export const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  senhaHash: { type: DataTypes.STRING(255), allowNull: false },
}, { tableName: 'usuarios' });

export const Produto = sequelize.define('Produto', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nome: { type: DataTypes.STRING(140), allowNull: false },
  precoVenda: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  quantidadeEstoque: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  estoqueMinimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  categoria: { type: DataTypes.STRING(80), allowNull: true },
  descricao: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'produtos' });

export const EntradaMercadoria = sequelize.define('EntradaMercadoria', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  quantidade: { type: DataTypes.INTEGER, allowNull: false },
  custoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  fornecedor: { type: DataTypes.STRING(140), allowNull: true },
  observacao: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'entradas_mercadoria' });

export const Venda = sequelize.define('Venda', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  formaPagamento: { type: DataTypes.ENUM('DINHEIRO', 'PIX', 'CARTAO'), allowNull: false },
  cliente: { type: DataTypes.STRING(140), allowNull: true },
}, { tableName: 'vendas' });

export const ItemVenda = sequelize.define('ItemVenda', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  quantidade: { type: DataTypes.INTEGER, allowNull: false },
  valorUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  nomeProduto: { type: DataTypes.STRING(140), allowNull: false },
}, { tableName: 'itens_venda' });

export const Sessao = sequelize.define('Sessao', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  jti: { type: DataTypes.UUID, allowNull: false, unique: true },
  expiraEm: { type: DataTypes.DATE, allowNull: false },
  revogadaEm: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'sessoes' });

Usuario.hasMany(Produto, { as: 'produtos', foreignKey: { name: 'usuarioId', allowNull: false }, onDelete: 'CASCADE' });
Produto.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
Usuario.hasMany(EntradaMercadoria, { as: 'entradas', foreignKey: { name: 'usuarioId', allowNull: false }, onDelete: 'CASCADE' });
EntradaMercadoria.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
Usuario.hasMany(Venda, { as: 'vendas', foreignKey: { name: 'usuarioId', allowNull: false }, onDelete: 'CASCADE' });
Venda.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
Usuario.hasMany(Sessao, { as: 'sessoes', foreignKey: { name: 'usuarioId', allowNull: false }, onDelete: 'CASCADE' });
Sessao.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
Produto.hasMany(EntradaMercadoria, { as: 'entradas', foreignKey: { name: 'produtoId', allowNull: false }, onDelete: 'RESTRICT' });
EntradaMercadoria.belongsTo(Produto, { as: 'produto', foreignKey: 'produtoId' });
Venda.hasMany(ItemVenda, { as: 'itens', foreignKey: { name: 'vendaId', allowNull: false }, onDelete: 'CASCADE' });
ItemVenda.belongsTo(Venda, { as: 'venda', foreignKey: 'vendaId' });
Produto.hasMany(ItemVenda, { as: 'itensVenda', foreignKey: { name: 'produtoId', allowNull: false }, onDelete: 'RESTRICT' });
ItemVenda.belongsTo(Produto, { as: 'produto', foreignKey: 'produtoId' });
