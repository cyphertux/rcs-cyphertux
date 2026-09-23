import type {
  ActiveFlow,
  RevealFlow,
  SealFlow,
  TransmitFlow,
} from "@/domain/types";
import type { MemoryEntry } from "@/domain/memory";
import { aggregateEmitters } from "@/domain/memory";
import type { BitcoinProvider, PreparedTransmission } from "@/bitcoin/types";
import { MIN_TRANSMIT_SATS } from "@/bitcoin/config";
import { UNLOCK_PRESETS, REVEAL_DECLARED_SATS } from "@/bitcoin/protocol/rcs02";
import { FAUCET_PATH, getTutorialSteps } from "@/domain/tutorial";
import { wait } from "@/domain/format";
import { playCue } from "@/audio/audioSystem";
import {
  listPendingSeals,
  markSealRevealed,
  saveLastTransmission,
  savePendingSeal,
} from "@/storage/local";
import { t } from "@/locale/core";

export type FlowIO = {
  append: (kind: "output" | "system" | "error" | "dim" | "bright", text: string) => void;
  clear: () => void;
  getFlow: () => ActiveFlow;
  setFlow: (flow: ActiveFlow) => void;
  setPrompt: (label: string) => void;
  setLocked: (locked: boolean) => void;
  getMemory: () => MemoryEntry[];
  setMemory: (entries: MemoryEntry[]) => void;
  getChannel: () => string;
  getBlock: () => number;
  setBlock: (n: number) => void;
  bitcoin: BitcoinProvider;
  reducedMotion: boolean;
  setVisualMode: (
    mode:
      | "idle"
      | "network"
      | "transmit"
      | "seal"
      | "reveal"
      | "memory"
      | "emitters"
      | "help"
      | "calendar"
      | "status"
      | "about"
      | "debug"
      | "link"
      | "tutorial"
      | "error",
  ) => void;
  setCursorMode: (mode: "idle" | "processing" | "transmitting" | "receiving" | "error") => void;
  goIdle: () => void;
  getVisualMode: () => string;
  getNodeStatus: () => "ONLINE" | "DEGRADED" | "OFFLINE";
  getWalletBalance: () => number;
  /** Wallet bridge */
  isWalletConnected: () => boolean;
  getWalletAddress: () => string | null;
  /** Fresh Unisat balance — use after connect / before funding checks */
  refreshWalletBalance: () => Promise<number>;
  getPublicKey: () => Promise<string>;
  signPsbt: (
    psbtBase64: string,
    options?: {
      autoFinalized?: boolean;
      toSignInputs?: Array<{
        index: number;
        address?: string;
        publicKey?: string;
        useTweakedSigner?: boolean;
      }>;
    },
  ) => Promise<string>;
  /** Broadcast via Unisat when Esplora /tx fails */
  pushPsbt: (psbtOrTxHex: string) => Promise<string>;
  /** Wallet UTXOs for prepare fallback */
  getWalletUtxos: () => Promise<
    Array<{ txid: string; vout: number; value: number }>
  >;
  refreshMemory: () => Promise<MemoryEntry[]>;
  refreshStatus: () => Promise<void>;
  connectWallet: () => Promise<void>;
};

function delay(io: FlowIO, ms: number): Promise<void> {
  return wait(io.reducedMotion ? Math.min(ms, 50) : ms);
}

const BUSY_STEPS = new Set(["signing", "signal", "broadcast"]);

/** One level back; root of a stage → sommaire. Ignores ESC mid broadcast. */
export function goBack(io: FlowIO): void {
  const flow = io.getFlow();

  if (flow?.kind === "transmit") {
    if (BUSY_STEPS.has(flow.step)) return;
    if (flow.step === "message") {
      io.setFlow({ ...flow, step: "value" });
      io.setPrompt(">");
      io.setCursorMode("idle");
      return;
    }
    if (flow.step === "confirm") {
      io.setFlow({
        ...flow,
        step: "message",
        psbtBase64: undefined,
        feeSats: undefined,
        anchorSats: undefined,
        totalSats: undefined,
        changeSats: undefined,
        inputSats: undefined,
        feeRateSatVb: undefined,
        truncated: undefined,
      });
      io.setPrompt(">");
      io.setCursorMode("idle");
      return;
    }
    io.goIdle();
    return;
  }

  if (flow?.kind === "seal") {
    if (BUSY_STEPS.has(flow.step)) return;
    if (flow.step === "message") {
      io.setFlow({ ...flow, step: "value" });
      io.setPrompt(">");
      io.setCursorMode("idle");
      return;
    }
    if (flow.step === "unlock") {
      io.setFlow({ ...flow, step: "message", unlockDelta: undefined });
      io.setPrompt(">");
      io.setCursorMode("idle");
      return;
    }
    if (flow.step === "confirm") {
      io.setFlow({
        ...flow,
        step: "unlock",
        lockHeight: undefined,
        commitHash: undefined,
        lockAddress: undefined,
        lockVout: undefined,
        lockValue: undefined,
        leafScriptHex: undefined,
        controlBlockHex: undefined,
        outputScriptHex: undefined,
        xOnlyPubHex: undefined,
        redeemVersion: undefined,
        psbtBase64: undefined,
        feeSats: undefined,
        anchorSats: undefined,
        totalSats: undefined,
        changeSats: undefined,
        inputSats: undefined,
        feeRateSatVb: undefined,
      });
      io.setPrompt(">");
      io.setCursorMode("idle");
      return;
    }
    io.goIdle();
    return;
  }

  if (flow?.kind === "reveal") {
    if (BUSY_STEPS.has(flow.step)) return;
    if (flow.step === "confirm" || flow.step === "locked") {
      io.setFlow({
        kind: "reveal",
        step: "list",
        selectedIndex: undefined,
        sealTxid: undefined,
        sats: undefined,
        message: undefined,
        lockHeight: undefined,
        commitHash: undefined,
        channel: undefined,
        tip: undefined,
        psbtBase64: undefined,
        signHints: undefined,
        feeSats: undefined,
        anchorSats: undefined,
        totalSats: undefined,
        changeSats: undefined,
        inputSats: undefined,
        feeRateSatVb: undefined,
        truncated: undefined,
        error: undefined,
      });
      io.setPrompt(">");
      io.setCursorMode("idle");
      return;
    }
    io.goIdle();
    return;
  }

  if (flow?.kind === "memory") {
    if (flow.step === "detail") {
      io.setFlow({ kind: "memory", step: "list", selectedId: undefined });
      io.setCursorMode("idle");
      return;
    }
    io.goIdle();
    return;
  }

  if (flow?.kind === "emitters") {
    if (flow.step === "detail") {
      io.setFlow({
        kind: "emitters",
        step: "list",
        selectedAddress: undefined,
      });
      io.setCursorMode("idle");
      return;
    }
    io.goIdle();
    return;
  }

  if (flow?.kind === "calendar") {
    if (flow.step === "day") {
      io.setFlow({ kind: "calendar", step: "grid", selectedDate: undefined });
      io.setCursorMode("idle");
      return;
    }
    io.goIdle();
    return;
  }

  if (flow?.kind === "tutorial") {
    if (typeof flow.step === "number" && flow.step > 0) {
      io.setFlow({ kind: "tutorial", step: flow.step - 1 });
      io.setPrompt(">");
      io.setCursorMode("idle");
      return;
    }
    io.goIdle();
    return;
  }

  if (io.getVisualMode() !== "idle") {
    io.goIdle();
  }
}

async function ensureWalletReady(io: FlowIO): Promise<boolean> {
  if (!io.isWalletConnected()) {
    io.append("dim", "LINKING WALLET…");
    io.setCursorMode("processing");
    try {
      await io.connectWallet();
      playCue("confirm");
    } catch (e) {
      playCue("error");
      io.append("error", e instanceof Error ? e.message : "WALLET NOT CONNECTED");
      io.append("dim", "TYPE CONNECT · OR TUTORIAL");
      io.setCursorMode("error");
      return false;
    }
  }
  return true;
}

/** Connect if needed, then read a fresh balance from Unisat (not stale React state). */
async function requireFundedWallet(io: FlowIO): Promise<number | null> {
  if (!(await ensureWalletReady(io))) return null;
  try {
    return await io.refreshWalletBalance();
  } catch {
    return io.getWalletBalance();
  }
}

async function loadWalletUtxos(io: FlowIO): Promise<
  | Array<{
      txid: string;
      vout: number;
      status: { confirmed: boolean };
      value: number;
    }>
  | undefined
> {
  try {
    const raw = await io.getWalletUtxos();
    if (raw.length === 0) return undefined;
    return raw.map((u) => ({
      txid: u.txid,
      vout: u.vout,
      value: u.value,
      status: { confirmed: true },
    }));
  } catch {
    return undefined;
  }
}

async function broadcastSigned(
  io: FlowIO,
  signed: string,
): Promise<string> {
  try {
    const result = await io.bitcoin.broadcastSignedPsbt(signed);
    return result.txid;
  } catch (esploraErr) {
    io.append("dim", t("line.esploraPushFail"));
    try {
      return await io.pushPsbt(signed);
    } catch (walletErr) {
      const a =
        esploraErr instanceof Error ? esploraErr.message : "ESPLORA FAIL";
      const b =
        walletErr instanceof Error ? walletErr.message : "WALLET PUSH FAIL";
      throw new Error(`${a} · ${b}`);
    }
  }
}

export async function startTransmit(io: FlowIO): Promise<void> {
  const offline = io.getNodeStatus() === "OFFLINE";

  const balance = await requireFundedWallet(io);
  if (balance == null) return;

  if (offline) {
    io.append("dim", t("line.tipMuteTransmit"));
  }

  if (balance < MIN_TRANSMIT_SATS) {
    playCue("error");
    io.setVisualMode("transmit");
    io.setFlow({
      kind: "transmit",
      step: "failed",
      sats: 0,
      message: "",
      error: `NEED ~${MIN_TRANSMIT_SATS} SAT · HAVE ${balance}`,
    });
    io.setCursorMode("error");
    io.setPrompt(">");
    return;
  }

  io.setVisualMode("transmit");
  io.setCursorMode("idle");
  io.setFlow({ kind: "transmit", step: "value", sats: 0, message: "" });
  io.setPrompt(">");
  playCue("beep");
}

export async function handleTransmitInput(
  io: FlowIO,
  raw: string,
): Promise<boolean> {
  const flow = io.getFlow();
  if (!flow || flow.kind !== "transmit") return false;
  const input = raw.trim();

  if (flow.step === "value") {
    const cleaned = input.replace(/[^0-9]/g, "");
    const n = Number(cleaned);
    if (!cleaned || !Number.isFinite(n) || n <= 0) {
      io.setCursorMode("error");
      return true;
    }
    io.setFlow({ ...flow, step: "message", sats: n });
    io.setCursorMode("idle");
    return true;
  }

  if (flow.step === "message") {
    const message = input || "for whoever finds this";
    if (message.length > 140) {
      io.setCursorMode("error");
      return true;
    }
    io.setFlow({ ...flow, step: "confirm", message });
    io.setPrompt("?");
    io.setCursorMode("processing");

    try {
      const address = io.getWalletAddress();
      if (!address) throw new Error("WALLET NOT CONNECTED");

      const walletUtxos = await loadWalletUtxos(io);

      const prepared = await io.bitcoin.prepareTransmission({
        message,
        sats: flow.sats,
        channel: io.getChannel(),
        fromAddress: address,
        walletUtxos,
      });
      io.setFlow({
        ...flow,
        step: "confirm",
        message,
        feeSats: prepared.feeSats,
        anchorSats: prepared.anchorSats,
        totalSats: prepared.totalSats,
        changeSats: prepared.changeSats,
        inputSats: prepared.inputSats,
        feeRateSatVb: prepared.feeRateSatVb,
        truncated: prepared.truncated,
        psbtBase64: prepared.psbtBase64,
      });
      io.setCursorMode("idle");
    } catch (e) {
      io.setFlow({
        ...flow,
        step: "failed",
        message,
        error: e instanceof Error ? e.message : "PREPARE FAILED",
      });
      io.setCursorMode("error");
      io.setPrompt(">");
      io.setLocked(false);
    }
    return true;
  }

  if (flow.step === "confirm") {
    const ans = input.toUpperCase();
    if (ans === "N" || ans === "NO") {
      io.setFlow({ ...flow, step: "cancelled" });
      io.append("dim", "TRANSMISSION CANCELLED");
      await delay(io, 800);
      io.goIdle();
      return true;
    }
    if (ans !== "Y" && ans !== "YES") {
      return true;
    }
    await runRealTransmit(io, flow);
    return true;
  }

  if (flow.step === "failed") {
    const ans = input.toUpperCase();
    if (!ans || ans === "RETRY" || ans === "ENTER" || ans === "ENTREE") {
      await startTransmit(io);
      return true;
    }
    if (ans === "C" || ans === "CONNECT") {
      try {
        await io.connectWallet();
      } catch {
        /* still retry start — will surface connect errors */
      }
      await startTransmit(io);
      return true;
    }
    if (ans === "T" || ans === "TUTORIAL") {
      startTutorial(io);
      return true;
    }
    return true;
  }

  if (flow.step === "cancelled") {
    io.goIdle();
    return true;
  }

  return true;
}

async function runRealTransmit(io: FlowIO, flow: TransmitFlow): Promise<void> {
  if (!flow.psbtBase64) {
    io.setFlow({ ...flow, step: "failed", error: "NO PSBT" });
    return;
  }

  io.setLocked(true);
  io.setFlow({ ...flow, step: "signing" });
  io.setCursorMode("processing");
  io.setPrompt("·");

  let signed: string;
  try {
    signed = await io.signPsbt(flow.psbtBase64);
    playCue("confirm");
  } catch {
    playCue("error");
    io.setFlow({ ...flow, step: "cancelled", error: "SIGNATURE REJECTED" });
    io.setCursorMode("error");
    io.setLocked(false);
    io.setPrompt(">");
    await delay(io, 1200);
    io.goIdle();
    return;
  }

  io.setFlow({ ...flow, step: "signal" });
  io.setCursorMode("transmitting");
  playCue("relay");
  await delay(io, 700);

  io.setFlow({ ...flow, step: "broadcast" });
  io.setCursorMode("receiving");

  try {
    const txid = await broadcastSigned(io, signed);

    io.setFlow({ ...flow, step: "broadcast", txid });
    saveLastTransmission({
      txid,
      sats: flow.sats,
      message: flow.message,
      channel: io.getChannel(),
      at: new Date().toISOString(),
    });
    playCue("print");
    io.append("dim", t("line.utxoIndex"));

    let confirmed = false;
    let blockHeight: number | undefined;
    for (let i = 0; i < 30; i++) {
      await delay(io, io.reducedMotion ? 200 : 2000);
      try {
        const st = await io.bitcoin.getTransmissionStatus(txid);
        if (st.status === "CONFIRMED") {
          confirmed = true;
          blockHeight = st.blockHeight;
          playCue("success");
          break;
        }
        if (st.status === "FAILED") break;
      } catch {
        break;
      }
    }

    let entry: MemoryEntry | undefined;
    try {
      const memory = await io.refreshMemory();
      entry = memory.find((m) => m.txid === txid);
    } catch {
      /* memory index optional after wallet broadcast */
    }

    if (!confirmed && !entry) {
      io.setFlow({
        ...flow,
        step: "confirmed",
        txid,
        blockHeight,
      });
      io.append("dim", t("line.txRelayedPending"));
      if (!confirmed) playCue("success");
    } else {
      io.setFlow({
        ...flow,
        step: "confirmed",
        txid,
        blockHeight: blockHeight ?? entry?.blockHeight ?? undefined,
        memoryId: entry?.id,
      });
      if (!confirmed) playCue("success");
    }

    io.setCursorMode("idle");
    await delay(io, 2800);
    io.goIdle();
  } catch (e) {
    io.setFlow({
      ...flow,
      step: "failed",
      error: e instanceof Error ? e.message : "TRANSMISSION FAILED",
    });
    playCue("error");
    io.setCursorMode("error");
    io.setLocked(false);
    io.setPrompt(">");
  }
}

export async function startSeal(io: FlowIO): Promise<void> {
  const balance = await requireFundedWallet(io);
  if (balance == null) return;

  if (balance < MIN_TRANSMIT_SATS) {
    playCue("error");
    io.setVisualMode("seal");
    io.setFlow({
      kind: "seal",
      step: "failed",
      sats: 0,
      message: "",
      error: `NEED ~${MIN_TRANSMIT_SATS} SAT · HAVE ${balance}`,
    });
    io.setCursorMode("error");
    io.setPrompt(">");
    return;
  }

  io.setVisualMode("seal");
  io.setCursorMode("idle");
  io.setFlow({ kind: "seal", step: "value", sats: 0, message: "" });
  io.setPrompt(">");
  playCue("beep");
}

export async function handleSealInput(
  io: FlowIO,
  raw: string,
): Promise<boolean> {
  const flow = io.getFlow();
  if (!flow || flow.kind !== "seal") return false;
  const input = raw.trim();

  if (flow.step === "value") {
    const cleaned = input.replace(/[^0-9]/g, "");
    const n = Number(cleaned);
    if (!cleaned || !Number.isFinite(n) || n <= 0) {
      io.setCursorMode("error");
      return true;
    }
    io.setFlow({ ...flow, step: "message", sats: n });
    io.setCursorMode("idle");
    return true;
  }

  if (flow.step === "message") {
    const message = input || "sealed for later";
    if (message.length > 140) {
      io.setCursorMode("error");
      return true;
    }
    io.setFlow({
      ...flow,
      step: "unlock",
      message,
      unlockDelta: UNLOCK_PRESETS[0] as number,
    });
    io.setCursorMode("idle");
    return true;
  }

  if (flow.step === "unlock") {
    let delta: number = UNLOCK_PRESETS[0];
    if (input) {
      const cleaned = input.replace(/[^0-9]/g, "");
      const n = Number(cleaned);
      if (!cleaned || !Number.isFinite(n) || n <= 0) {
        io.setCursorMode("error");
        return true;
      }
      delta = n;
    }
    const tip = io.getBlock();
    const lockHeight = tip > 0 ? tip + delta : delta;
    io.setFlow({
      ...flow,
      step: "confirm",
      unlockDelta: delta,
      lockHeight,
    });
    io.setPrompt("?");
    io.setCursorMode("processing");

    try {
      const address = io.getWalletAddress();
      if (!address) throw new Error("WALLET NOT CONNECTED");
      const pubkeyHex = await io.getPublicKey();
      const walletUtxos = await loadWalletUtxos(io);
      const prepared = await io.bitcoin.prepareSeal({
        message: flow.message,
        sats: flow.sats,
        channel: io.getChannel(),
        fromAddress: address,
        lockHeight,
        pubkeyHex,
        walletUtxos,
      });
      io.setFlow({
        ...flow,
        step: "confirm",
        unlockDelta: delta,
        lockHeight: prepared.lockHeight ?? lockHeight,
        commitHash: prepared.commitHash,
        lockAddress: prepared.lock?.lockAddress,
        lockVout: prepared.lock?.lockVout,
        lockValue: prepared.lock?.lockValue,
        leafScriptHex: prepared.lock?.leafScriptHex,
        controlBlockHex: prepared.lock?.controlBlockHex,
        outputScriptHex: prepared.lock?.outputScriptHex,
        xOnlyPubHex: prepared.lock?.xOnlyPubHex,
        redeemVersion: prepared.lock?.redeemVersion,
        feeSats: prepared.feeSats,
        anchorSats: prepared.anchorSats,
        totalSats: prepared.totalSats,
        changeSats: prepared.changeSats,
        inputSats: prepared.inputSats,
        feeRateSatVb: prepared.feeRateSatVb,
        psbtBase64: prepared.psbtBase64,
      });
      io.setCursorMode("idle");
    } catch (e) {
      io.setFlow({
        ...flow,
        step: "failed",
        unlockDelta: delta,
        lockHeight,
        error: e instanceof Error ? e.message : "SEAL PREPARE FAILED",
      });
      io.setCursorMode("error");
      io.setPrompt(">");
      io.setLocked(false);
    }
    return true;
  }

  if (flow.step === "confirm") {
    const ans = input.toUpperCase();
    if (ans === "N" || ans === "NO") {
      io.setFlow({ ...flow, step: "cancelled" });
      io.append("dim", "SEAL CANCELLED");
      await delay(io, 800);
      io.goIdle();
      return true;
    }
    if (ans !== "Y" && ans !== "YES") {
      return true;
    }
    await runSealBroadcast(io, flow);
    return true;
  }

  if (flow.step === "failed") {
    const ans = input.toUpperCase();
    if (!ans || ans === "RETRY" || ans === "ENTER" || ans === "ENTREE") {
      await startSeal(io);
      return true;
    }
    if (ans === "C" || ans === "CONNECT") {
      try {
        await io.connectWallet();
      } catch {
        /* still retry start */
      }
      await startSeal(io);
      return true;
    }
    if (ans === "T" || ans === "TUTORIAL") {
      startTutorial(io);
      return true;
    }
    return true;
  }

  if (flow.step === "cancelled") {
    io.goIdle();
    return true;
  }

  return true;
}

async function runSealBroadcast(io: FlowIO, flow: SealFlow): Promise<void> {
  if (!flow.psbtBase64 || !flow.lockHeight || !flow.commitHash) {
    io.setFlow({ ...flow, step: "failed", error: "NO PSBT" });
    return;
  }

  io.setLocked(true);
  io.setFlow({ ...flow, step: "signing" });
  io.setCursorMode("processing");
  io.setPrompt("·");

  let signed: string;
  try {
    signed = await io.signPsbt(flow.psbtBase64);
    playCue("confirm");
  } catch {
    playCue("error");
    io.setFlow({ ...flow, step: "cancelled", error: "SIGNATURE REJECTED" });
    io.setCursorMode("error");
    io.setLocked(false);
    io.setPrompt(">");
    await delay(io, 1200);
    io.goIdle();
    return;
  }

  io.setFlow({ ...flow, step: "signal" });
  io.setCursorMode("transmitting");
  playCue("relay");
  await delay(io, 700);

  io.setFlow({ ...flow, step: "broadcast" });
  io.setCursorMode("receiving");

  try {
    const txid = await broadcastSigned(io, signed);
    savePendingSeal({
      sealTxid: txid,
      message: flow.message,
      commitHash: flow.commitHash,
      lockHeight: flow.lockHeight,
      sats: flow.sats,
      channel: io.getChannel(),
      at: new Date().toISOString(),
      lockAddress: flow.lockAddress,
      lockVout: flow.lockVout,
      lockValue: flow.lockValue,
      leafScriptHex: flow.leafScriptHex,
      controlBlockHex: flow.controlBlockHex,
      outputScriptHex: flow.outputScriptHex,
      xOnlyPubHex: flow.xOnlyPubHex,
      redeemVersion: flow.redeemVersion,
    });
    playCue("print");
    io.append("dim", t("line.utxoIndex"));

    let blockHeight: number | undefined;
    let gotConfirm = false;
    for (let i = 0; i < 20; i++) {
      await delay(io, io.reducedMotion ? 200 : 2000);
      try {
        const st = await io.bitcoin.getTransmissionStatus(txid);
        if (st.status === "CONFIRMED") {
          blockHeight = st.blockHeight;
          gotConfirm = true;
          playCue("success");
          break;
        }
        if (st.status === "FAILED") break;
      } catch {
        break;
      }
    }

    try {
      await io.refreshMemory();
    } catch {
      /* optional */
    }

    io.setFlow({
      ...flow,
      step: "confirmed",
      txid,
      blockHeight,
    });
    if (!gotConfirm) playCue("success");
    io.setCursorMode("idle");
    await delay(io, 2800);
    io.goIdle();
  } catch (e) {
    io.setFlow({
      ...flow,
      step: "failed",
      error: e instanceof Error ? e.message : "SEAL FAILED",
    });
    playCue("error");
    io.setCursorMode("error");
    io.setLocked(false);
    io.setPrompt(">");
  }
}

export async function startReveal(io: FlowIO): Promise<void> {
  if (!(await ensureWalletReady(io))) return;

  let tip = io.getBlock();
  try {
    tip = await io.bitcoin.getBlockHeight();
    io.setBlock(tip);
  } catch {
    /* keep tip */
  }

  const pending = listPendingSeals().filter((s) => !s.revealed);
  const readyCount = pending.filter((s) => tip >= s.lockHeight).length;
  io.setVisualMode("reveal");
  io.setCursorMode("idle");
  io.setFlow({
    kind: "reveal",
    step: pending.length === 0 ? "failed" : "list",
    tip,
    error: pending.length === 0 ? "NO LOCAL SEALS" : undefined,
  });
  io.setPrompt(">");
  if (readyCount > 0) playCue("unlock");
  else playCue("beep");
}

export async function handleRevealInput(
  io: FlowIO,
  raw: string,
): Promise<boolean> {
  const flow = io.getFlow();
  if (!flow || flow.kind !== "reveal") return false;
  const input = raw.trim();
  const upper = input.toUpperCase();

  if (flow.step === "list") {
    if (upper === "Q" || upper === "QUIT") {
      io.goIdle();
      return true;
    }
    const pending = listPendingSeals().filter((s) => !s.revealed);
    const idx = Number(input.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(idx) || idx < 1 || idx > pending.length) {
      io.setCursorMode("error");
      return true;
    }
    const seal = pending[idx - 1]!;
    const tip = flow.tip ?? io.getBlock();
    const revealSats = REVEAL_DECLARED_SATS;
    if (tip < seal.lockHeight) {
      io.setFlow({
        ...flow,
        step: "locked",
        selectedIndex: idx,
        sealTxid: seal.sealTxid,
        message: seal.message,
        sats: revealSats,
        lockHeight: seal.lockHeight,
        commitHash: seal.commitHash,
        channel: seal.channel,
        tip,
      });
      io.setCursorMode("idle");
      return true;
    }

    io.setFlow({
      ...flow,
      step: "confirm",
      selectedIndex: idx,
      sealTxid: seal.sealTxid,
      message: seal.message,
      sats: revealSats,
      lockHeight: seal.lockHeight,
      commitHash: seal.commitHash,
      channel: seal.channel,
      tip,
    });
    io.setPrompt("?");
    io.setCursorMode("processing");

    try {
      const address = io.getWalletAddress();
      if (!address) throw new Error("WALLET NOT CONNECTED");
      const walletUtxos = await loadWalletUtxos(io);
      const lockSpend =
        seal.leafScriptHex &&
        seal.controlBlockHex &&
        seal.outputScriptHex &&
        seal.lockVout != null &&
        seal.lockValue != null &&
        seal.xOnlyPubHex &&
        seal.redeemVersion != null
          ? {
              txid: seal.sealTxid,
              lockAddress: seal.lockAddress ?? "",
              lockVout: seal.lockVout,
              lockValue: seal.lockValue,
              leafScriptHex: seal.leafScriptHex,
              controlBlockHex: seal.controlBlockHex,
              outputScriptHex: seal.outputScriptHex,
              xOnlyPubHex: seal.xOnlyPubHex,
              redeemVersion: seal.redeemVersion,
            }
          : undefined;
      const prepared = await io.bitcoin.prepareReveal({
        message: seal.message,
        sats: revealSats,
        channel: seal.channel,
        fromAddress: address,
        lockHeight: seal.lockHeight,
        lockSpend,
        walletUtxos,
      });
      io.setFlow({
        ...flow,
        step: "confirm",
        selectedIndex: idx,
        sealTxid: seal.sealTxid,
        message: seal.message,
        sats: revealSats,
        lockHeight: seal.lockHeight,
        commitHash: seal.commitHash,
        channel: seal.channel,
        tip,
        feeSats: prepared.feeSats,
        anchorSats: prepared.anchorSats,
        totalSats: prepared.totalSats,
        changeSats: prepared.changeSats,
        inputSats: prepared.inputSats,
        feeRateSatVb: prepared.feeRateSatVb,
        truncated: prepared.truncated,
        psbtBase64: prepared.psbtBase64,
        signHints: prepared.signHints,
      });
      io.setCursorMode("idle");
    } catch (e) {
      io.setFlow({
        ...flow,
        step: "failed",
        error: e instanceof Error ? e.message : "REVEAL PREPARE FAILED",
      });
      io.setCursorMode("error");
      io.setPrompt(">");
    }
    return true;
  }

  if (flow.step === "locked") {
    io.setFlow({ ...flow, step: "list", selectedIndex: undefined });
    io.setPrompt(">");
    return true;
  }

  if (flow.step === "confirm") {
    const ans = upper;
    if (ans === "N" || ans === "NO") {
      io.setFlow({ ...flow, step: "cancelled" });
      io.append("dim", "REVEAL CANCELLED");
      await delay(io, 800);
      io.goIdle();
      return true;
    }
    if (ans !== "Y" && ans !== "YES") {
      return true;
    }
    await runRevealBroadcast(io, flow);
    return true;
  }

  if (
    flow.step === "failed" ||
    flow.step === "cancelled" ||
    flow.step === "confirmed"
  ) {
    io.goIdle();
    return true;
  }

  return true;
}

async function runRevealBroadcast(
  io: FlowIO,
  flow: RevealFlow,
): Promise<void> {
  if (
    !flow.psbtBase64 ||
    !flow.sealTxid ||
    !flow.message ||
    flow.sats == null ||
    !flow.lockHeight
  ) {
    io.setFlow({ ...flow, step: "failed", error: "NO PSBT" });
    return;
  }

  io.setLocked(true);
  io.setFlow({ ...flow, step: "signing" });
  io.setCursorMode("processing");
  io.setPrompt("·");

  let signed: string;
  try {
    const address = io.getWalletAddress();
    const hints = flow.signHints;
    let pubkeyHex = hints?.pubkeyHex;
    if (hints?.tapInputIndexes?.length && !pubkeyHex) {
      pubkeyHex = await io.getPublicKey();
    }
    // Unisat: leaf holds x-only; pass account compressed pubkey for signer select
    if (pubkeyHex && pubkeyHex.length === 64) {
      try {
        const full = await io.getPublicKey();
        if (full.length === 66) pubkeyHex = full;
      } catch {
        /* keep x-only */
      }
    }
    const toSignInputs =
      hints && address
        ? [
            ...hints.tapInputIndexes.map((index) => ({
              index,
              publicKey: pubkeyHex,
              useTweakedSigner: false as const,
            })),
            ...(hints.feeInputIndexes ?? []).map((index) => ({
              index,
              address,
            })),
          ]
        : undefined;
    signed = await io.signPsbt(
      flow.psbtBase64,
      toSignInputs
        ? { autoFinalized: true, toSignInputs }
        : { autoFinalized: true },
    );
    playCue("confirm");
  } catch {
    playCue("error");
    io.setFlow({ ...flow, step: "cancelled", error: "SIGNATURE REJECTED" });
    io.setCursorMode("error");
    io.setLocked(false);
    io.setPrompt(">");
    await delay(io, 1200);
    io.goIdle();
    return;
  }

  io.setFlow({ ...flow, step: "signal" });
  io.setCursorMode("transmitting");
  playCue("relay");
  await delay(io, 700);

  io.setFlow({ ...flow, step: "broadcast" });
  io.setCursorMode("receiving");

  try {
    const txid = await broadcastSigned(io, signed);
    markSealRevealed(flow.sealTxid, txid);
    playCue("print");
    io.append("dim", t("line.utxoIndex"));

    let blockHeight: number | undefined;
    let gotConfirm = false;
    for (let i = 0; i < 20; i++) {
      await delay(io, io.reducedMotion ? 200 : 2000);
      try {
        const st = await io.bitcoin.getTransmissionStatus(txid);
        if (st.status === "CONFIRMED") {
          blockHeight = st.blockHeight;
          gotConfirm = true;
          playCue("success");
          break;
        }
        if (st.status === "FAILED") break;
      } catch {
        break;
      }
    }

    try {
      await io.refreshMemory();
    } catch {
      /* optional */
    }

    io.setFlow({
      ...flow,
      step: "confirmed",
      txid,
      blockHeight,
    });
    if (!gotConfirm) playCue("success");
    io.setCursorMode("idle");
    await delay(io, 2800);
    io.goIdle();
  } catch (e) {
    io.setFlow({
      ...flow,
      step: "failed",
      error: e instanceof Error ? e.message : "REVEAL FAILED",
    });
    playCue("error");
    io.setCursorMode("error");
    io.setLocked(false);
    io.setPrompt(">");
  }
}

export async function startMemory(io: FlowIO): Promise<void> {
  io.setVisualMode("memory");
  io.setCursorMode("receiving");
  io.setLocked(true);
  try {
    const entries = await io.refreshMemory();
    io.setMemory(entries);
    io.setFlow({ kind: "memory", step: "list" });
    io.setPrompt(">");
  } catch (e) {
    io.append("error", e instanceof Error ? e.message : "MEMORY INDEX FAILED");
    io.setCursorMode("error");
    io.goIdle();
  } finally {
    io.setLocked(false);
    io.setCursorMode("idle");
  }
}

export function handleMemoryInput(io: FlowIO, raw: string): boolean {
  const flow = io.getFlow();
  if (!flow || flow.kind !== "memory") return false;
  const input = raw.trim().toUpperCase();

  if (input === "Q" || input === "QUIT" || input === "EXIT") {
    io.goIdle();
    return true;
  }

  if (
    input === "RETURN" ||
    input === "B" ||
    (flow.step === "detail" && input === "")
  ) {
    if (flow.step === "detail") {
      io.setFlow({ kind: "memory", step: "list", selectedId: undefined });
      return true;
    }
    io.goIdle();
    return true;
  }

  if (flow.step === "detail") {
    io.setFlow({ kind: "memory", step: "list", selectedId: undefined });
    return true;
  }

  const memory = io.getMemory();
  let entry: MemoryEntry | undefined;
  const asIndex = Number(input);
  if (Number.isFinite(asIndex) && asIndex >= 1 && asIndex <= memory.length) {
    // list is newest-first in UI — map carefully: we show descending ids
    const sorted = [...memory].sort((a, b) => b.id.localeCompare(a.id));
    entry = sorted[asIndex - 1];
  } else {
    const padded = input.padStart(6, "0");
    entry = memory.find((t) => t.id === input || t.id === padded);
  }

  if (!entry) {
    io.setCursorMode("error");
    return true;
  }

  io.setFlow({ kind: "memory", step: "detail", selectedId: entry.id });
  io.setCursorMode("idle");
  return true;
}

export async function startEmitters(io: FlowIO): Promise<void> {
  io.setVisualMode("emitters");
  io.setCursorMode("receiving");
  io.setLocked(true);
  try {
    const entries = await io.refreshMemory();
    io.setMemory(entries);
    io.setFlow({ kind: "emitters", step: "list" });
    io.setPrompt(">");
  } catch (e) {
    io.append("error", e instanceof Error ? e.message : "EMITTERS INDEX FAILED");
    io.setCursorMode("error");
    io.goIdle();
  } finally {
    io.setLocked(false);
    io.setCursorMode("idle");
  }
}

export function handleEmittersInput(io: FlowIO, raw: string): boolean {
  const flow = io.getFlow();
  if (!flow || flow.kind !== "emitters") return false;
  const input = raw.trim().toUpperCase();

  if (input === "Q" || input === "QUIT" || input === "EXIT") {
    io.goIdle();
    return true;
  }

  if (
    input === "RETURN" ||
    input === "B" ||
    (flow.step === "detail" && input === "")
  ) {
    if (flow.step === "detail") {
      io.setFlow({
        kind: "emitters",
        step: "list",
        selectedAddress: undefined,
      });
      return true;
    }
    io.goIdle();
    return true;
  }

  if (flow.step === "detail") {
    io.setFlow({ kind: "emitters", step: "list", selectedAddress: undefined });
    return true;
  }

  const emitters = aggregateEmitters(io.getMemory());
  const asIndex = Number(input.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(asIndex) || asIndex < 1 || asIndex > emitters.length) {
    io.setCursorMode("error");
    return true;
  }
  const picked = emitters[asIndex - 1];
  if (!picked) {
    io.setCursorMode("error");
    return true;
  }
  io.setFlow({
    kind: "emitters",
    step: "detail",
    selectedAddress: picked.address,
  });
  io.setCursorMode("idle");
  return true;
}

export function startCalendar(io: FlowIO): void {
  io.setVisualMode("calendar");
  io.setCursorMode("idle");
  io.setFlow({ kind: "calendar", step: "grid" });
  io.setPrompt(">");
  io.append("dim", "CALENDAR — DAY NUMBER OR Q");
}

export function handleCalendarInput(io: FlowIO, raw: string): boolean {
  const flow = io.getFlow();
  if (!flow || flow.kind !== "calendar") return false;
  const input = raw.trim().toUpperCase();

  if (input === "Q" || input === "QUIT" || input === "EXIT") {
    io.goIdle();
    return true;
  }

  if (flow.step === "day" && (input === "" || input === "RETURN" || input === "B")) {
    io.setFlow({ kind: "calendar", step: "grid" });
    return true;
  }

  const day = Number(input.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    io.setCursorMode("error");
    return true;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (day > daysInMonth) {
    io.setCursorMode("error");
    return true;
  }

  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  io.setFlow({ kind: "calendar", step: "day", selectedDate: key });
  io.setCursorMode("idle");
  return true;
}

export function startTutorial(io: FlowIO): void {
  io.setVisualMode("tutorial");
  io.setCursorMode("idle");
  io.setFlow({ kind: "tutorial", step: 0 });
  io.setPrompt(">");
  const n = getTutorialSteps().length;
  io.append("dim", `TUTORIAL — 1…${n} · N · Q`);
}

export async function handleTutorialInput(
  io: FlowIO,
  raw: string,
): Promise<boolean> {
  const flow = io.getFlow();
  if (!flow || flow.kind !== "tutorial") return false;
  const input = raw.trim();
  const upper = input.toUpperCase();

  if (upper === "Q" || upper === "QUIT" || upper === "EXIT") {
    io.goIdle();
    return true;
  }

  if (upper === "B" || upper === "MENU" || upper === "RETURN") {
    io.setFlow({ kind: "tutorial", step: 0 });
    io.setPrompt(">");
    const n = getTutorialSteps().length;
    io.append("dim", `MENU — SELECT 1…${n}`);
    return true;
  }

  // Jump commands usable from any tutorial step
  if (upper === "CONNECT") {
    io.setCursorMode("processing");
    try {
      await io.connectWallet();
      io.append("bright", "WALLET CONNECTED");
      const addr = io.getWalletAddress();
      if (addr) io.append("output", addr);
      io.setFlow({ kind: "tutorial", step: 3 });
      io.setPrompt(">");
      io.append("dim", "NEXT — FUND STEP · TYPE ADDR");
      io.setCursorMode("idle");
    } catch (e) {
      io.append("error", e instanceof Error ? e.message : "CONNECT FAILED");
      io.setCursorMode("error");
    }
    return true;
  }

  if (upper === "ADDR" || upper === "ADDRESS") {
    const addr = io.getWalletAddress();
    if (!addr || !io.isWalletConnected()) {
      io.append("dim", "NO ADDRESS — TYPE CONNECT FIRST");
      io.setFlow({ kind: "tutorial", step: 2 });
    } else {
      io.append("bright", "ADDRESS");
      io.append("output", addr);
      io.append("dim", `FAUCET  ${FAUCET_PATH}`);
      io.append("dim", "PASTE IN BROWSER · CLAIM tBTC");
    }
    return true;
  }

  if (upper === "FAUCET") {
    io.append("bright", "FAUCET");
    io.append("output", FAUCET_PATH);
    io.append("dim", "OPEN IN BROWSER · TESTNET4 ONLY");
    return true;
  }

  if (upper === "LINK") {
    if (io.isWalletConnected()) {
      io.append("bright", "◉ LINKED");
      const addr = io.getWalletAddress();
      if (addr) io.append("output", addr);
    } else {
      io.append("dim", "○ NOT LINKED — TYPE CONNECT");
    }
    return true;
  }

  if (upper === "TRANSMIT" || upper === "TX" || upper === "SEND") {
    await startTransmit(io);
    return true;
  }

  if (upper === "SEAL" || upper === "SCEAU") {
    await startSeal(io);
    return true;
  }

  if (upper === "REVEAL" || upper === "OUVRIR") {
    await startReveal(io);
    return true;
  }

  if (upper === "MEMORY" || upper === "MEM" || upper === "ARCHIVE") {
    await startMemory(io);
    return true;
  }

  if (upper === "N" || upper === "NEXT" || upper === "") {
    const steps = getTutorialSteps();
    const next = flow.step >= steps.length ? 0 : flow.step + 1;
    io.setFlow({ kind: "tutorial", step: next });
    if (next === 0) {
      io.append("dim", `MENU — SELECT 1…${steps.length}`);
    } else {
      const def = steps[next - 1];
      if (def) io.append("dim", `STEP ${def.id} ${def.title} · ${def.action}`);
    }
    return true;
  }

  const n = Number(upper.replace(/[^0-9]/g, ""));
  const steps = getTutorialSteps();
  if (Number.isFinite(n) && n >= 1 && n <= steps.length) {
    io.setFlow({ kind: "tutorial", step: n });
    const def = steps[n - 1];
    if (def) {
      io.append("dim", `STEP ${def.id} ${def.title}`);
      for (const line of def.lines) io.append("output", line);
      io.append("dim", `CMD  ${def.action}  ·  N  ·  B  ·  Q`);
    }
    return true;
  }

  io.setCursorMode("error");
  io.append("error", `USE 1…${steps.length} · N · CONNECT · ADDR · FAUCET · Q`);
  setTimeout(() => io.setCursorMode("idle"), 500);
  return true;
}

export type { PreparedTransmission };