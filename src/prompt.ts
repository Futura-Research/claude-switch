import * as readline from "node:readline";

/* v8 ignore start — integration boundary: reads from interactive stdin */
export function confirm(message: string, defaultYes = true): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (defaultYes) {
        resolve(trimmed !== "n" && trimmed !== "no");
      } else {
        resolve(trimmed === "y" || trimmed === "yes");
      }
    });
  });
}
/* v8 ignore stop */
