"use client";

import { listVisibleCommands } from "@/domain/commands/registry";
import { useLocale } from "@/locale";
import type { MessageKey } from "@/locale/core";
import { LcdList, LcdListItem, LcdPanel } from "./LcdPanel";

export function HelpView() {
  const { t } = useLocale();
  const commands = listVisibleCommands();

  return (
    <LcdPanel
      title={t("help.title")}
      meta={t("help.meta", { n: commands.length })}
      hint={t("help.hint")}
    >
      <LcdList>
        {commands.map((cmd) => (
          <LcdListItem
            key={cmd.name}
            code={cmd.name}
            desc={t(cmd.description as MessageKey)}
          />
        ))}
      </LcdList>
    </LcdPanel>
  );
}
