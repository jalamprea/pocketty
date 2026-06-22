/**
 * Genera el hash bcrypt de un password para guardarlo en PASSWORD_HASH.
 *
 * Uso:
 *   npm run hash               -> pregunta el password por stdin (oculto no garantizado)
 *   npm run hash -- 'miPass'   -> hashea el argumento
 */
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

async function readPassword(): Promise<string> {
  const fromArg = process.argv[2];
  if (fromArg) return fromArg;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Password a hashear: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const password = (await readPassword()).trim();
  if (!password) {
    console.error('No se ingresó password.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log('\nAgrega esto a tu .env:\n');
  console.log(`PASSWORD_HASH=${hash}\n`);
}

main();
