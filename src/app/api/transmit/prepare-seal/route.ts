import { NextResponse } from "next/server";
import { createTestnetProvider } from "@/bitcoin/testnetProvider";
import { BITCOIN_CONFIG } from "@/bitcoin/config";
import {
  clientIp,
  rateLimitAllow,
  rateLimitResponse,
} from "@/server/rateLimit";
import {
  isHex,
  isMessage,
  isPositiveSats,
  isTestnetAddress,
  MAX_WALLET_UTXOS,
  sanitizeClientError,
} from "@/server/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (BITCOIN_CONFIG.network !== "testnet") {
      return NextResponse.json({ error: "TESTNET ONLY" }, { status: 400 });
    }
    const ip = clientIp(request);
    if (!rateLimitAllow(`prepare-seal:${ip}`, 20, 60_000)) {
      return rateLimitResponse(60);
    }

    const body = (await request.json()) as {
      message?: string;
      sats?: number;
      channel?: string;
      fromAddress?: string;
      lockHeight?: number;
      pubkeyHex?: string;
      walletUtxos?: Array<{
        txid: string;
        vout: number;
        value: number;
        status?: { confirmed: boolean; block_height?: number };
      }>;
    };
    if (
      !isTestnetAddress(body.fromAddress) ||
      !isMessage(body.message) ||
      !isPositiveSats(body.sats) ||
      typeof body.lockHeight !== "number" ||
      !Number.isInteger(body.lockHeight) ||
      body.lockHeight < 1 ||
      !isHex(body.pubkeyHex, 64, 66)
    ) {
      return NextResponse.json({ error: "INVALID FIELDS" }, { status: 400 });
    }
    const utxos = body.walletUtxos?.slice(0, MAX_WALLET_UTXOS);
    const provider = createTestnetProvider();
    const prepared = await provider.prepareSeal({
      message: body.message,
      sats: body.sats,
      channel: body.channel ?? BITCOIN_CONFIG.defaultChannel,
      fromAddress: body.fromAddress.trim(),
      lockHeight: body.lockHeight,
      pubkeyHex: body.pubkeyHex,
      walletUtxos: utxos?.map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        status: u.status ?? { confirmed: true },
      })),
    });
    return NextResponse.json(prepared);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeClientError(e, "SEAL PREPARE FAILED") },
      { status: 400 },
    );
  }
}
