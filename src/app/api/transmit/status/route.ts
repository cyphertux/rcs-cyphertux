import { NextResponse } from "next/server";
import { createTestnetProvider } from "@/bitcoin/testnetProvider";
import {
  clientIp,
  rateLimitAllow,
  rateLimitResponse,
} from "@/server/rateLimit";
import { isTxid, sanitizeClientError } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ip = clientIp(request);
    if (!rateLimitAllow(`tx-status:${ip}`, 60, 60_000)) {
      return rateLimitResponse(30);
    }
    const txid = new URL(request.url).searchParams.get("txid");
    if (!isTxid(txid)) {
      return NextResponse.json({ error: "INVALID TXID" }, { status: 400 });
    }
    const provider = createTestnetProvider();
    const status = await provider.getTransmissionStatus(txid);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: sanitizeClientError(e, "STATUS FAILED") },
      { status: 502 },
    );
  }
}
