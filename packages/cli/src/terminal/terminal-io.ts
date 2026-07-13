import { enterTuiScreen, exitTuiScreen, paintFrame, paintInitialFrame } from '../render/ansi.js';

export type TerminalIO = {
  isInteractive: boolean;
  write: (text: string) => void;
  paint: (content: string, initial?: boolean) => void;
  onData: (handler: (chunk: string) => void) => () => void;
  enterRawMode: () => void;
  exitRawMode: () => void;
};

export function createNodeTerminalIO(): TerminalIO {
  const stdin = process.stdin;
  const stdout = process.stdout;
  const isInteractive = Boolean(stdin.isTTY && stdout.isTTY);
  let rawModeEnabled = false;
  let firstPaint = true;

  return {
    isInteractive,
    write(text: string) {
      stdout.write(text);
    },
    paint(content: string, initial = false) {
      if (initial || firstPaint) {
        stdout.write(paintInitialFrame(content));
        firstPaint = false;
        return;
      }
      stdout.write(paintFrame(content));
    },
    onData(handler) {
      const listener = (chunk: Buffer | string) => {
        handler(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      };
      stdin.on('data', listener);
      return () => {
        stdin.off('data', listener);
      };
    },
    enterRawMode() {
      if (!isInteractive || rawModeEnabled) {
        return;
      }
      stdin.setRawMode?.(true);
      stdin.resume();
      rawModeEnabled = true;
      firstPaint = true;
      stdout.write(enterTuiScreen());
    },
    exitRawMode() {
      if (!isInteractive || !rawModeEnabled) {
        return;
      }
      stdin.setRawMode?.(false);
      rawModeEnabled = false;
      stdout.write(exitTuiScreen());
    },
  };
}
