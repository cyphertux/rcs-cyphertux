type Runner = (cmd: string) => void | Promise<void>;

let runner: Runner | null = null;

/** InstrumentInput registers the live command executor */
export function registerMenuRunner(fn: Runner | null): void {
  runner = fn;
}

export function runMenuCommand(cmd: string): void {
  void runner?.(cmd);
}
