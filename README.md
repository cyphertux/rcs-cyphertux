# RCS — Remote Communication System

LCD instrument (**Channel 07**) + Bitcoin **Testnet4** protocol (`RCS/01` open transmit, `RCS/02` seal/reveal).

Site: [rcs.cyphertux.net](https://rcs.cyphertux.net) · Spec: [docs/PROTOCOL.md](docs/PROTOCOL.md)

## Run

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Optional in `.env.local`:

```
NEXT_PUBLIC_BITCOIN_NETWORK=testnet
NEXT_PUBLIC_ESPLORA_URL=https://mempool.space/testnet4/api
NEXT_PUBLIC_PROTOCOL_SINK_ADDRESS=tb1qtx6zuvpf3tdt2ymtdzwrma8sclr2w2wy90lvvd
```

## Get testnet coins

1. [Unisat](https://unisat.io) → network **Bitcoin Testnet4**
2. `CONNECT` then `LINK` (or copy address from the wallet panel)
3. Faucets: [mempool.space/testnet4](https://mempool.space/testnet4), [testnet4.info](https://testnet4.info/), [cypherfaucet](https://cypherfaucet.com/btc-testnet)
4. Wait for 1 confirmation → `TRANSMIT` (≈1000+ free sats) or `SEAL` (extra ~546 for the lock UTXO)

## Operator flow

1. Fund Testnet4 address  
2. `CONNECT` → `TRANSMIT` or `SEAL` → approve PSBT → `MEMORY`  
3. After unlock height: `REVEAL` (needs the seal still listed locally for hard Taproot spend)

## Notes

- No private keys in the app (wallet signs)
- Broadcast API is testnet-only; mainnet not enabled
- Declared value below dust uses a **546 SAT** sink anchor — shown before sign
- Server rate-limits APIs; broadcast only relays validated RCS txs that pay the sink
