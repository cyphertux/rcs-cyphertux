import { createClientBitcoinProvider } from "./clientProvider";
import type { BitcoinProvider } from "./types";

/** UI always gets the client provider — never mock by default */
export function createBitcoinProvider(): BitcoinProvider {
  return createClientBitcoinProvider();
}

export type { BitcoinProvider } from "./types";
