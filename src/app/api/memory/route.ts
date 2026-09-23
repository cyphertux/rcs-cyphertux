import { NextResponse } from "next/server";
import {
  indexMemory,
  invalidateMemoryCache,
} from "@/bitcoin/memory/indexer";
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
    if (!rateLimitAllow(`memory:${ip}`, 40, 60_000)) {
      return rateLimitResponse(30);
    }

    const { searchParams } = new URL(request.url);
    const txid = searchParams.get("txid");
    const id = searchParams.get("id");
    const refresh = searchParams.get("refresh") === "1";

    if (txid && !isTxid(txid)) {
      return NextResponse.json({ error: "INVALID TXID" }, { status: 400 });
    }
    if (id && (id.length > 12 || !/^[0-9A-Za-z]+$/.test(id))) {
      return NextResponse.json({ error: "INVALID ID" }, { status: 400 });
    }

    if (refresh) invalidateMemoryCache();
    const entries = await indexMemory();

    if (txid) {
      const hit = entries.find((e) => e.txid === txid) ?? null;
      return NextResponse.json({ entry: hit, entries: hit ? [hit] : [] });
    }
    if (id) {
      const padded = id.padStart(6, "0");
      const hit =
        entries.find((e) => e.id === id || e.id === padded) ?? null;
      return NextResponse.json({ entry: hit, entries: hit ? [hit] : [] });
    }

    return NextResponse.json({
      count: entries.length,
      entries,
      protocol: "RCS/01",
      network: "testnet",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: sanitizeClientError(e, "INDEX FAILED"),
        entries: [],
        count: 0,
      },
      { status: 502 },
    );
  }
}
