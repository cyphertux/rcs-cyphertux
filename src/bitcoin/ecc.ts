import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";

let ready = false;

/** Call before any p2tr / taproot PSBT work (server + client). */
export function ensureEcc(): void {
  if (ready) return;
  bitcoin.initEccLib(ecc);
  ready = true;
}
