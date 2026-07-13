#!/usr/bin/env node

import { parseCliArgs, runCli } from './cli.js';

function main(argv: string[]): number {
  try {
    const options = parseCliArgs(argv);
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

process.exit(main(process.argv.slice(2)));
