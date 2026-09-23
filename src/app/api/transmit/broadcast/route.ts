import { NextResponse } from "next/server";
import { createTestnetProvider } from "@/bitcoin/testnetProvider";
import { BITCOIN_CONFIG } from "@/bitcoin/config";
import { extractAndAssertRcsTx } from "@/server/rcsRelay";
import {
  clientIp,
  rateLimitAllow,
  rateLimitResponse,
} from "@/server/rateLimit";
import { MAX_SIGNED_CHARS, sanitizeClientError } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (BITCOIN_CONFIG.network !== "testnet") {
      return NextResponse.json({ error: "TESTNET ONLY" }, { status: 400 });
    }
    const ip = clientIp(request);
    if (!rateLimitAllow(`broadcast:${ip}`, 10, 60_000)) {
      return rateLimitResponse(60);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_SIGNED_CHARS + 512) {
      return NextResponse.json({ error: "PAYLOAD TOO LARGE" }, { status: 413 });
    }

    const body = (await request.json()) as { signed?: string };
    if (!body.signed || typeof body.signed !== "string") {
      return NextResponse.json({ error: "MISSING SIGNED PSBT" }, { status: 400 });
    }

    // Validate RCS + sink before any Esplora POST
    const hex = extractAndAssertRcsTx(body.signed);
    const provider = createTestnetProvider();
    const result = await provider.broadcastRawHex(hex);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeClientError(e, "BROADCAST FAILED") },
      { status: 400 },
    );
  }
}
