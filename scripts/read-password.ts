// Reads a password from stdin without echoing it, so it never ends up in
// shell history or a CI log. Falls back to USER_PASSWORD for non-interactive
// use, and to a plain (echoed) read when stdin is not a TTY.
import { createInterface } from 'node:readline';

export async function readPassword(prompt: string): Promise<string> {
  const fromEnv = process.env.USER_PASSWORD;
  if (fromEnv) return fromEnv;

  if (!process.stdin.isTTY) {
    // Piped input, e.g. `echo "..." | npm run user:create -- ...`
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) {
      rl.close();
      return line;
    }
    throw new Error('No password supplied on stdin and USER_PASSWORD is not set.');
  }

  process.stdout.write(prompt);

  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    let value = '';

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const done = (err: Error | null) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (err) reject(err);
      else resolve(value);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          done(null);
          return;
        }
        if (char === '\u0003') {
          done(new Error('Aborted.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= ' ') value += char;
      }
    };

    stdin.on('data', onData);
  });
}
