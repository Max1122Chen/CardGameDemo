import { enterTuiScreen, exitTuiScreen } from '../render/ansi.js';
import { paintBufferedFrame, resolveTerminalSize } from '../render/frame-buffer.js';

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

  const paintContent = (content: string) => {
    const size = resolveTerminalSize(stdout);
    stdout.write(paintBufferedFrame(content, size));
  };

  return {
    isInteractive,
    write(text: string) {
      stdout.write(text);
    },
    paint(content: string, _initial = false) {
      paintContent(content);
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
      stdout.write(enterTuiScreen());
    },
    exitRawMode() {
      if (!isInteractive || rawModeEnabled === false) {
        return;
      }
      stdin.setRawMode?.(false);
      rawModeEnabled = false;
      stdout.write(exitTuiScreen());
    },
  };
}
