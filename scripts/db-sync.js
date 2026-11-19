import { sequelize } from '../src/models/index.js';
try {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Banco conectado. Tabelas ausentes criadas com sucesso.');
} catch (error) {
  console.error('Falha na inicialização do banco:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
