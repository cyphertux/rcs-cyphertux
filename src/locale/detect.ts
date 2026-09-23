export type Locale = "fr" | "en";

const STORAGE_KEY = "rcs-lang";

function fromTag(tag: string | undefined | null): Locale | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("fr")) return "fr";
  return null;
}

/** Explicit override: ?lang=en|fr → localStorage → browser. */
export function detectLocale(tag?: string): Locale {
  if (tag) {
    return fromTag(tag) ?? "fr";
  }

  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search).get("lang");
      const fromQuery = fromTag(q);
      if (fromQuery) {
        try {
          localStorage.setItem(STORAGE_KEY, fromQuery);
        } catch {
          /* ignore */
        }
        return fromQuery;
      }
      const stored = fromTag(localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch {
      /* ignore */
    }

    const langs =
      navigator.languages?.length
        ? [...navigator.languages]
        : [navigator.language];
    for (const l of langs) {
      const hit = fromTag(l);
      if (hit) return hit;
    }
  }

  return "fr";
}

export function clearLocaleOverride(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
