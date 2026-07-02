/**
 * Generates the bcrypt hash of a password to store it in PASSWORD_HASH.
 *
 * Usage:
 *   npm run hash               -> asks for the password via stdin (hidden not guaranteed)
 *   npm run hash -- 'myPass'   -> hashes the argument
 */
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

async function readPassword(): Promise<string> {
  const fromArg = process.argv[2];
  if (fromArg) return fromArg;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Password to hash: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const password = (await readPassword()).trim();
  if (!password) {
    console.error('No password provided.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log('\nAdd this to your .env:\n');
  console.log(`PASSWORD_HASH=${hash}\n`);
}

main();
