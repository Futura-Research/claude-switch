import * as readline from "node:readline";

/* v8 ignore start — integration boundary: reads from interactive stdin */
export function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== "n");
    });
  });
}
/* v8 ignore stop */
