#!/usr/bin/env node

import { parseCliArgs, runCli, runTuiCli } from './cli.js';

async function main(argv: string[]): Promise<number> {
  try {
    const options = parseCliArgs(argv);

    if (options.mode === 'battle' || options.mode === 'debug' || options.mode === 'dungeon') {
      return runTuiCli(options);
    }

    const result = runCli(options);
    if (result.stdout.length > 0) {
      process.stdout.write(result.stdout);
    }
    return result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`cardgame: ${message}`);
    return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`cardgame: ${message}`);
    process.exit(1);
  });
