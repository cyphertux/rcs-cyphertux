import type { NetworkReveal } from "@/domain/types";
import type { FlowIO } from "@/domain/flows";
import {
  goBack,
  handleCalendarInput,
  handleEmittersInput,
  handleMemoryInput,
  handleRevealInput,
  handleSealInput,
  handleTransmitInput,
  handleTutorialInput,
  startCalendar,
  startEmitters,
  startMemory,
  startReveal,
  startSeal,
  startTransmit,
  startTutorial,
} from "@/domain/flows";
import { registerCommand } from "./registry";
import { formatSats } from "@/domain/format";
import { playCue } from "@/audio/audioSystem";
import { t } from "@/locale/core";

export type CommandContext = {
  args: string[];
  raw: string;
  appendLine: (
    kind: "output" | "system" | "error" | "dim" | "bright",
    text: string,
  ) => void;
  clearLines: () => void;
  toggleMute: () => boolean;
  getStatus: () => {
    channel: string;
    nodeStatus: string;
    blockHeight: number;
    queueSize: number;
    time: string;
    networkLabel: string;
    memoryCount: number;
    feeRateSatVb: number;
    nextFeeSatVb: number;
    mempoolFill: number;
    tipAgeSec: number;
  };
  getNetworkReveal: () => NetworkReveal;
  bumpNetworkReveal: () => NetworkReveal;
  flowIO: FlowIO;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  walletConnected: () => boolean;
  walletAddress: () => string | null;
  walletBalance: () => number;
};

let registered = false;

export function ensureCommandsRegistered(): void {
  if (registered) return;
  registered = true;

  registerCommand({
    name: "HELP",
    aliases: ["?"],
    description: "cmd.HELP",
    handler: (ctx) => {
      ctx.flowIO.setVisualMode("help");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setCursorMode("idle");
      ctx.flowIO.setPrompt(">");
      ctx.appendLine("dim", t("line.helpStage"));
    },
  });

  registerCommand({
    name: "TUTORIAL",
    aliases: ["GUIDE", "START"],
    description: "cmd.TUTORIAL",
    handler: (ctx) => {
      startTutorial(ctx.flowIO);
    },
  });

  registerCommand({
    name: "STATUS",
    description: "cmd.STATUS",
    handler: async (ctx) => {
      ctx.flowIO.setCursorMode("processing");
      try {
        await ctx.flowIO.refreshStatus();
      } catch {
        ctx.appendLine("error", t("line.statusFail"));
      }
      ctx.flowIO.setVisualMode("status");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setCursorMode("idle");
      ctx.flowIO.setPrompt(">");
      const s = ctx.getStatus();
      ctx.appendLine(
        "dim",
        t("line.statusOk", { h: s.blockHeight, node: s.nodeStatus }),
      );
    },
  });

  registerCommand({
    name: "NETWORK",
    aliases: ["NET"],
    description: "cmd.NETWORK",
    handler: async (ctx) => {
      ctx.flowIO.setCursorMode("receiving");
      try {
        await ctx.flowIO.refreshStatus();
      } catch {
        /* keep last known */
      }
      ctx.bumpNetworkReveal();
      ctx.flowIO.setVisualMode("network");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setPrompt(">");
      playCue("relay");
    },
  });

  registerCommand({
    name: "LINK",
    description: "cmd.LINK",
    handler: (ctx) => {
      ctx.flowIO.setVisualMode("link");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setCursorMode("idle");
      ctx.flowIO.setPrompt(">");
      if (ctx.walletConnected()) {
        ctx.appendLine("bright", t("line.walletOn"));
        ctx.appendLine("dim", t("line.balance", { sats: formatSats(ctx.walletBalance()) }));
      } else {
        ctx.appendLine("dim", t("line.walletOff"));
      }
    },
  });

  registerCommand({
    name: "CONNECT",
    description: "cmd.CONNECT",
    handler: async (ctx) => {
      ctx.flowIO.setVisualMode("link");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setCursorMode("processing");
      ctx.appendLine("dim", t("line.unisatReq"));
      try {
        await ctx.connectWallet();
        ctx.appendLine("bright", t("line.walletOn"));
        ctx.appendLine("output", `◉ ${ctx.walletAddress()}`);
        ctx.appendLine("dim", t("line.balance", { sats: formatSats(ctx.walletBalance()) }));
        ctx.appendLine("dim", t("line.transmitNow"));
        ctx.flowIO.setCursorMode("idle");
        playCue("confirm");
      } catch (e) {
        ctx.appendLine("error", e instanceof Error ? e.message : t("line.connectFail"));
        ctx.appendLine("dim", t("line.unlock"));
        ctx.flowIO.setCursorMode("error");
        playCue("error");
      }
    },
  });

  registerCommand({
    name: "DISCONNECT",
    description: "cmd.DISCONNECT",
    handler: (ctx) => {
      ctx.disconnectWallet();
      ctx.flowIO.setVisualMode("link");
      ctx.flowIO.setFlow(null);
      ctx.appendLine("dim", t("line.walletGone"));
    },
  });

  registerCommand({
    name: "TRANSMIT",
    aliases: ["TX", "SEND"],
    description: "cmd.TRANSMIT",
    handler: async (ctx) => {
      await startTransmit(ctx.flowIO);
    },
  });

  registerCommand({
    name: "SEAL",
    aliases: ["SCEAU"],
    description: "cmd.SEAL",
    handler: async (ctx) => {
      await startSeal(ctx.flowIO);
    },
  });

  registerCommand({
    name: "REVEAL",
    aliases: ["OUVRIR"],
    description: "cmd.REVEAL",
    handler: async (ctx) => {
      await startReveal(ctx.flowIO);
    },
  });

  registerCommand({
    name: "MEMORY",
    aliases: ["ARCHIVE", "MEM"],
    description: "cmd.MEMORY",
    handler: async (ctx) => {
      await startMemory(ctx.flowIO);
    },
  });

  registerCommand({
    name: "EMITTERS",
    aliases: ["OPS", "OPERATORS", "EMETTEURS"],
    description: "cmd.EMITTERS",
    handler: async (ctx) => {
      await startEmitters(ctx.flowIO);
    },
  });

  registerCommand({
    name: "CALENDAR",
    aliases: ["CAL"],
    description: "cmd.CALENDAR",
    handler: async (ctx) => {
      ctx.flowIO.setCursorMode("processing");
      try {
        await ctx.flowIO.refreshMemory();
      } catch {
        ctx.appendLine("error", t("line.memFail"));
      }
      startCalendar(ctx.flowIO);
    },
  });

  registerCommand({
    name: "CLEAR",
    aliases: ["CLS", "IDLE"],
    description: "cmd.CLEAR",
    handler: (ctx) => {
      ctx.clearLines();
      ctx.flowIO.goIdle();
    },
  });

  registerCommand({
    name: "RETOUR",
    aliases: ["BACK"],
    description: "cmd.RETOUR",
    handler: (ctx) => {
      goBack(ctx.flowIO);
    },
  });

  registerCommand({
    name: "ABOUT",
    description: "cmd.ABOUT",
    handler: (ctx) => {
      ctx.flowIO.setVisualMode("about");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setCursorMode("idle");
      ctx.flowIO.setPrompt(">");
      ctx.appendLine("dim", t("line.aboutStage"));
    },
  });

  registerCommand({
    name: "DEBUG",
    description: "cmd.DEBUG",
    handler: async (ctx) => {
      ctx.flowIO.setCursorMode("processing");
      try {
        await ctx.flowIO.refreshStatus();
      } catch {
        /* probe view will show failure */
      }
      ctx.flowIO.setVisualMode("debug");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setCursorMode("idle");
      ctx.flowIO.setPrompt(">");
      ctx.appendLine("dim", t("line.debugStage"));
    },
  });

  registerCommand({
    name: "WHOAMI",
    description: "cmd.WHOAMI",
    handler: (ctx) => {
      ctx.flowIO.setVisualMode("link");
      ctx.flowIO.setFlow(null);
      ctx.flowIO.setCursorMode("idle");
      if (ctx.walletConnected()) {
        ctx.appendLine("output", ctx.walletAddress() ?? "—");
      } else {
        ctx.appendLine("dim", t("line.unknownOp"));
      }
    },
  });

  registerCommand({
    name: "MUTE",
    description: "cmd.MUTE",
    handler: (ctx) => {
      const muted = ctx.toggleMute();
      if (!muted) playCue("confirm");
      ctx.appendLine("dim", muted ? t("line.muteOn") : t("line.muteOff"));
    },
  });

  registerCommand({
    name: "SAT",
    hidden: true,
    description: "cmd.SAT",
    handler: (ctx) => {
      const n = ctx.args[0] ?? "546";
      ctx.appendLine("output", `${formatSats(Number(n) || 546)}`);
    },
  });

  registerCommand({
    name: "RANDOM",
    hidden: true,
    description: "cmd.RANDOM",
    handler: (ctx) => {
      ctx.appendLine("dim", t("line.static"));
    },
  });

  registerCommand({
    name: "42",
    hidden: true,
    description: "cmd.42",
    handler: (ctx) => {
      ctx.appendLine("dim", t("line.try21"));
    },
  });
}

export async function handleSystemInput(
  input: string,
  ctx: Omit<CommandContext, "args" | "raw">,
): Promise<void> {
  const trimmed = input.trim();
  if (!trimmed) return;

  const flow = ctx.flowIO.getFlow();
  if (flow?.kind === "transmit") {
    await handleTransmitInput(ctx.flowIO, trimmed);
    return;
  }
  if (flow?.kind === "seal") {
    await handleSealInput(ctx.flowIO, trimmed);
    return;
  }
  if (flow?.kind === "reveal") {
    await handleRevealInput(ctx.flowIO, trimmed);
    return;
  }
  if (flow?.kind === "memory") {
    handleMemoryInput(ctx.flowIO, trimmed);
    return;
  }
  if (flow?.kind === "emitters") {
    handleEmittersInput(ctx.flowIO, trimmed);
    return;
  }
  if (flow?.kind === "calendar") {
    handleCalendarInput(ctx.flowIO, trimmed);
    return;
  }
  if (flow?.kind === "tutorial") {
    await handleTutorialInput(ctx.flowIO, trimmed);
    return;
  }

  const parts = trimmed.split(/\s+/);
  const name = parts[0] ?? "";
  const args = parts.slice(1);
  const { getCommand } = await import("./registry");
  const def = getCommand(name);

  if (!def) {
    ctx.flowIO.setCursorMode("error");
    ctx.appendLine("error", `UNKNOWN: ${name.toUpperCase()}`);
    setTimeout(() => ctx.flowIO.setCursorMode("idle"), 600);
    return;
  }

  await def.handler({ ...ctx, args, raw: trimmed });
}
