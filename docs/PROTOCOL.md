# RCS — Remote Communication System Protocol

Instrument **Channel 07** on Bitcoin **Testnet4**.  
Family version constant in app: `RCS/02` (covers open transmit + seal/reveal). Magics below stay distinct per message type.

**Network:** Testnet4 · Esplora primary `https://mempool.space/testnet4/api` · Unisat `BITCOIN_TESTNET4`  
**Mainnet:** refused by broadcast API unless explicitly enabled later.

**Strategy:** OP_RETURN on-chain + value output to a protocol sink (recoverable MEMORY from the chain).

---

## Protocol sink (testnet)

Default (override with `NEXT_PUBLIC_PROTOCOL_SINK_ADDRESS`):

```
tb1qtx6zuvpf3tdt2ymtdzwrma8sclr2w2wy90lvvd
```

Every valid RCS tx pays this address at least **dust** (`546` sats). Declared ritual VALUE may be lower; the on-chain sink amount is always:

```
anchorSats = max(declaredSats, 546)
```

---

## RCS/01 — open transmit (`TRANSMIT`)

### On-chain layout

1. **OP_RETURN** (0 sats) — payload  
2. **Sink** — `anchorSats` to protocol sink  
3. **Change** — remainder to operator  
4. **Fee** — miner fee (shown before sign)

### OP_RETURN (UTF-8, ≤ 80 bytes data)

```
RCS1|<channel>|<declaredSats>|<message>
```

Example: `RCS1|07|21|for whoever finds this`

Legacy (still decoded): `RCS1|<channel>|<message>`

| Field | Meaning |
|-------|---------|
| `RCS1` | magic |
| `channel` | 2-digit id (default `07`) |
| `declaredSats` | ritual VALUE (may be &lt; dust) |
| `message` | UTF-8; truncated to fit 80 bytes |

`protocolVersion` for these entries: `RCS/01` · kind: `open`

---

## RCS/02 — seal / reveal (`SEAL` / `REVEAL`)

Commit–reveal with an **absolute block height** unlock.

### Commit hash

```
commitHash = hex( SHA-256(UTF-8 message)[0:16] )   // 32 hex chars
```

### Seal OP_RETURN

```
RCS2|<channel>|<declaredSats>|<commitHash>|<lockHeight>
```

- `lockHeight` = tip + delay (UI presets: **144** ≈ 1 day, **1008** ≈ 7 days of blocks)  
- Message is **not** on-chain until reveal; MEMORY shows `████`

### Seal tx layout

1. OP_RETURN (`RCS2|…`)  
2. Sink (`anchorSats`)  
3. **P2TR CLTV lock** — `546` sats; leaf `<lockHeight> OP_CLTV OP_DROP <xOnlyPub> OP_CHECKSIG` (NUMS internal key)  
4. Change  

Hard cost ≈ sink anchor + **546 lock** + fee (beyond a plain transmit).

### Reveal OP_RETURN

```
RCS2R|<channel>|<declaredSats>|<message>
```

Ritual declared sats default **546**. Linkage to seal: same `channel` + `commitHashHex(message)` match.

### Reveal tx (hard path)

Spends the P2TR lock UTXO (+ fee inputs from wallet):

- `nLockTime = lockHeight`, sequence `0xfffffffe`  
- OP_RETURN (`RCS2R|…`) → sink → change  

Soft path (legacy seals without recoverable lock meta): OP_RETURN + sink only, still gated by tip ≥ lock.

`protocolVersion`: `RCS/02` · kinds: `sealed` → `revealed` (merged into the seal row when linked)

**Note:** pending seal scripts / unlock meta for hard reveal are kept in **localStorage**; the chain alone indexes seals/reveals via the sink, but the wallet needs local seal meta to spend the Taproot lock.

---

## Memory model

```ts
MemoryEntry {
  id: string                 // "000001" … order below
  createdAt: string          // ISO from block time (or first-seen)
  channel: string
  sats: number               // declared VALUE
  anchorSats: number         // on-chain sink output
  message: string            // plaintext, or "████" while sealed
  txid: string
  blockHeight: number | null
  status: "PENDING" | "CONFIRMED" | "FAILED"
  protocolVersion: "RCS/01" | "RCS/02"
  kind: "open" | "sealed" | "revealed"
  fromAddress?: string       // initiator (skip sink / prefer non-taproot vin)
  commitHash?: string
  unlockHeight?: number
  revealTxid?: string        // set when a reveal opens this seal
}
```

### Indexation (source of truth = chain)

1. Fetch txs paying the **protocol sink** (Esplora `/address/:addr/txs`)  
2. Parse first valid `RCS1` / `RCS2` / `RCS2R` OP_RETURN  
3. Link reveals into matching seals (hash + channel); drop standalone reveal rows  
4. Sort `(blockHeight ASC, txid ASC)` — unconfirmed last  
5. Assign sequential `id`  

API: `GET /api/memory` (15s cache). Force refresh: `?refresh=1`. Lookup: `?txid=` / `?id=`.

Broadcast relay only accepts txs that parse as RCS **and** pay the sink.

---

## Wallet & commands

- Keys never leave the browser wallet (Unisat PSBT)  
- Typical path: `CONNECT` → `TRANSMIT` / `SEAL` → sign → wait → `MEMORY`  
- Also: `REVEAL`, `EMITTERS`, `CALENDAR`, `STATUS`, `LINK`, `HELP`, `TUTORIAL`, …

No private keys or seeds on the server.

---

## Dust (summary)

| Role | Amount |
|------|--------|
| Declared VALUE | any positive ritual amount written in OP_RETURN |
| Sink output | `max(declared, 546)` |
| Seal lock UTXO | `546` sats (P2TR) |
| Rough min balance to transmit | ≈ `546 + 400` fee headroom; seal needs more |

UI shows **VALUE** vs **ANCHOR** when they differ.
