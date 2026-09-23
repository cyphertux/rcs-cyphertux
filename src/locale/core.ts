import { detectLocale, type Locale } from "./detect";
import { messages, type MessageKey } from "./dictionary";

export type { Locale, MessageKey };
export { detectLocale };

let current: Locale = "fr";
let detected = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
    return;
  }
  current = locale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
  try {
    localStorage.setItem("rcs-lang", locale);
  } catch {
    /* ignore */
  }
  emit();
}

export function applyDetectedLocale(): Locale {
  const next = detectLocale();
  const first = !detected;
  detected = true;
  if (next !== current) {
    current = next;
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    emit();
  } else if (first) {
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    emit();
  }
  return next;
}

export function hasDetectedLocale(): boolean {
  return detected;
}

export function subscribeLocale(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
  locale: Locale = current,
): string {
  const table = messages[locale] ?? messages.fr;
  let out: string = table[key] ?? messages.fr[key] ?? String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}
