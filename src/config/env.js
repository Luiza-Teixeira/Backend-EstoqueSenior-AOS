import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1).refine((s) => /^postgres(ql)?:\/\//.test(s), 'Deve ser uma URL PostgreSQL.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter no mínimo 32 caracteres.')
    .refine((valor) => !valor.includes('SUBSTITUIR') && !valor.includes('EXEMPLO'), 'Troque o JWT_SECRET de exemplo por uma chave aleatória.'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  ALLOWED_ORIGINS: z.string().default(''),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Ambiente inválido:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  throw new Error('Configure o .env conforme .env.example antes de iniciar.');
}
export default parsed.data;
