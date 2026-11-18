import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const roots = ['src', 'scripts', 'tests'];
const walk = (root) => readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const path = join(root, entry.name);
  return entry.isDirectory() ? walk(path) : path.endsWith('.js') ? [path] : [];
});
let arquivos = 0;
for (const root of roots) for (const file of walk(root)) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); arquivos++;
}
console.log(`Sintaxe verificada: ${arquivos} arquivos JavaScript.`);
