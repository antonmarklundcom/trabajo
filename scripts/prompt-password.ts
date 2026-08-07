// Shared interactive password prompt for create-user.ts / set-password.ts.
//
// Passwords are prompted for rather than passed as --password, because argv is
// visible in shell history and in `ps` output.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const MIN_LENGTH = 12;

/**
 * Asks for a password twice with the input hidden, and exits(1) on mismatch or
 * on anything shorter than MIN_LENGTH.
 *
 * Hiding relies on readline's `_writeToOutput` hook — the documented-by-
 * convention way to suppress echo, used because Node has no built-in
 * equivalent of `read -s`.
 */
export async function promptNewPassword(): Promise<string> {
  if (!stdin.isTTY) {
    console.error(
      'This script needs an interactive terminal to prompt for a password.\n' +
        'Run it directly rather than through a pipe or CI job.',
    );
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  let muted = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    if (!muted) stdout.write(s);
  };

  try {
    // The prompt is written directly to stdout, bypassing the muted hook —
    // otherwise muting would swallow the question along with the keystrokes.
    stdout.write(`Password (min ${MIN_LENGTH} chars): `);
    muted = true;
    const first = await rl.question('');
    muted = false;
    stdout.write('\n');

    stdout.write('Confirm password: ');
    muted = true;
    const second = await rl.question('');
    muted = false;
    stdout.write('\n');

    if (first !== second) {
      console.error('Passwords do not match.');
      process.exit(1);
    }
    if (first.length < MIN_LENGTH) {
      console.error(`Password must be at least ${MIN_LENGTH} characters.`);
      process.exit(1);
    }
    return first;
  } finally {
    muted = false;
    rl.close();
  }
}
