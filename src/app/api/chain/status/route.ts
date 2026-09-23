import { NextResponse } from "next/server";
import { createTestnetProvider } from "@/bitcoin/testnetProvider";
import { BITCOIN_CONFIG } from "@/bitcoin/config";
import {
  clientIp,
  rateLimitAllow,
  rateLimitResponse,
} from "@/server/rateLimit";
import { sanitizeClientError } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (BITCOIN_CONFIG.network !== "testnet") {
      return NextResponse.json({ error: "TESTNET ONLY" }, { status: 400 });
    }
    const ip = clientIp(request);
    if (!rateLimitAllow(`chain:${ip}`, 60, 60_000)) {
      return rateLimitResponse(30);
    }
    const provider = createTestnetProvider();
    const status = await provider.getStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeClientError(e, "STATUS FAILED") },
      { status: 502 },
    );
  }
}
