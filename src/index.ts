import { run } from "./cli.js";

Promise.resolve(run(process.argv.slice(2))).catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
