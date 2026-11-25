# Estoque Sênior — Backend

Projeto desenvolvido em equipe para a disciplina de **Aplicações Orientadas a Serviços (AOS)**, utilizando Node.js, Express e PostgreSQL.

## Sobre o projeto

O Estoque Sênior surgiu a partir de uma situação real que conhecemos no Projeto Integrador: um pequeno comércio de bairro administrado por mãe e filho. Enquanto o filho buscava uma forma de organizar melhor os produtos e as vendas, a mãe, uma comerciante idosa, já estava acostumada a fazer boa parte desse controle manualmente.

A partir disso, pensamos em um sistema de estoque e vendas que também considerasse as dificuldades que pessoas idosas podem ter ao utilizar a tecnologia. A preocupação com a **acessibilidade** orienta o projeto como um todo, especialmente sua interface no aplicativo mobile.

Nesta disciplina, desenvolvemos o **backend**, responsável pelos dados, pela autenticação e pelas regras de negócio que serão utilizadas pelo aplicativo.

## Funcionalidades

- Cadastro, login e logout com autenticação por JWT.
- Cadastro, listagem, consulta, edição e exclusão de produtos.
- Registro de entradas de mercadorias, com atualização do estoque.
- Registro de vendas, cálculo do total e baixa automática de produtos vendidos.
- Consulta de vendas e de seus itens.
- Consulta de estoque e identificação de produtos com estoque baixo.
- Resumo do dashboard e histórico de entradas e saídas.
- Separação dos registros por usuário autenticado.

## Tecnologias utilizadas

- **Node.js e Express 5:** construção da API REST.
- **PostgreSQL e Neon:** armazenamento dos dados.
- **Sequelize:** modelos e relacionamentos com o banco.
- **Zod:** validação dos dados recebidos.
- **JWT e bcryptjs:** autenticação e proteção das senhas.
- **Postman:** testes das requisições HTTP.

## Como executar

É necessário ter o **Node.js 20 ou superior** e acesso a um banco PostgreSQL.

1. Clone o repositório e instale as dependências:

   ```bash
   git clone https://github.com/Luiza-Teixeira/Backend-EstoqueSenior-AOS.git
   cd Backend-EstoqueSenior-AOS
   npm install
   ```

2. Crie um arquivo `.env` a partir do `.env.example` e configure pelo menos `DATABASE_URL` e `JWT_SECRET`. A chave JWT precisa ter **no mínimo 32 caracteres**. O arquivo `.env` não deve ser enviado para o GitHub.

3. Caso esteja utilizando um banco novo, crie as tabelas ausentes e inicie a API:

   ```bash
   npm run db:sync
   npm run dev
   ```

A API utiliza, por padrão, `http://localhost:3000`. A rota pública `GET /health` permite conferir se o servidor está respondendo.

## Testes

Para verificar a sintaxe do código:

```bash
npm run check
```

Para executar a suíte de testes:

```bash
npm test
```

Os testes de integração de entradas utilizam a variável **`TEST_DATABASE_URL`**, que deve apontar para um banco PostgreSQL **de testes, separado do banco principal**, já com as tabelas criadas. Essa variável pode ser configurada no `.env`. Sem ela, a suíte completa não será executada.

Também utilizamos uma coleção do **Postman** com requisições de cadastro, autenticação, produtos, entradas, vendas, consultas e cenários de erro. Após importar o arquivo JSON da coleção, basta configurar `baseUrl` e os dados da conta de teste.

Há ainda o comando `npm run db:seed` para inserir dados fictícios de demonstração. Para utilizá-lo, configure `DEMO_EMAIL_1`, `DEMO_EMAIL_2`, `DEMO_PASSWORD_1` e `DEMO_PASSWORD_2` no `.env`. Execute esse comando somente em um banco destinado a demonstrações ou testes.

## Principais endpoints

| Método | Rota | Finalidade |
| --- | --- | --- |
| POST | `/auth/cadastro` | Criar conta |
| POST | `/auth/login` | Entrar no sistema |
| POST | `/auth/logout` | Encerrar sessão |
| GET / PUT / DELETE | `/usuarios/me` | Consultar, atualizar ou excluir a conta |
| GET | `/usuarios/me/produtos` | Consultar os produtos da conta |
| GET / POST | `/produtos` | Listar e cadastrar produtos |
| GET / PUT / DELETE | `/produtos/:id` | Consultar, editar ou excluir produto |
| GET / POST | `/entradas-mercadoria` | Listar e registrar entradas |
| GET / PUT / DELETE | `/entradas-mercadoria/:id` | Consultar, editar ou excluir entrada |
| GET / POST | `/vendas` | Listar e registrar vendas |
| GET / PUT / DELETE | `/vendas/:id` | Consultar, editar ou excluir venda |
| GET | `/vendas/:id/itens` | Consultar os itens de uma venda |
| GET | `/estoque` | Consultar o estoque atual |
| GET | `/estoque/baixo` | Consultar produtos com estoque baixo |
| GET | `/dashboard/resumo` | Consultar indicadores gerais |
| GET | `/historico` | Consultar entradas e saídas |
| GET | `/historico/:id` | Consultar uma movimentação |

As rotas de gerenciamento exigem autenticação com `Authorization: Bearer <token>`. As rotas `/`, `/health`, `/auth/cadastro` e `/auth/login` são públicas.

## Organização da equipe

O desenvolvimento foi dividido por módulos:

| Integrante | Responsabilidade |
| --- | --- |
| **Dandália Teixeira** | Estrutura inicial, autenticação JWT, segurança e testes de autenticação. |
| **Adriel Bibiano** | Produtos, validações e testes do módulo. |
| **Arthur Santana** | Entradas de mercadorias, modelos, banco de dados e testes de integração. |
| **Jader Silva** | Vendas, itens, baixa automática do estoque nas vendas e testes. |
| **Victória Beltrão** | Dashboard, histórico, estrutura de inicialização da API e configuração para deploy. |

O aplicativo mobile pertence ao trabalho do Projeto Integrador. A integração com esta API faz parte da etapa final do projeto.

---

O objetivo do Estoque Sênior é ajudar pequenos comerciantes a organizar seus produtos e vendas, considerando também as necessidades de quem tem menos familiaridade com a tecnologia.
