export type CommandDef = {
  name: string;
  aliases?: string[];
  description: string;
  hidden?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (ctx: any) => void | Promise<void>;
};

const commands = new Map<string, CommandDef>();

export function registerCommand(def: CommandDef): void {
  commands.set(def.name.toUpperCase(), def);
  for (const alias of def.aliases ?? []) {
    commands.set(alias.toUpperCase(), def);
  }
}

export function getCommand(name: string): CommandDef | undefined {
  return commands.get(name.toUpperCase());
}

export function listVisibleCommands(): CommandDef[] {
  const seen = new Set<string>();
  const out: CommandDef[] = [];
  for (const def of commands.values()) {
    if (def.hidden || seen.has(def.name)) continue;
    seen.add(def.name);
    out.push(def);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
