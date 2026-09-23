"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import {
  applyDetectedLocale,
  detectLocale,
  getLocale,
  hasDetectedLocale,
  setLocale,
  subscribeLocale,
  t,
  type Locale,
  type MessageKey,
} from "./core";
import { clearLocaleOverride } from "./detect";

export type { Locale, MessageKey };
export {
  applyDetectedLocale,
  detectLocale,
  getLocale,
  setLocale,
  t,
};
export { clearLocaleOverride };

export function useLocale(): {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
} {
  const locale = useSyncExternalStore(
    subscribeLocale,
    getLocale,
    () => "fr" as Locale,
  );

  useLayoutEffect(() => {
    if (!hasDetectedLocale()) applyDetectedLocale();
    const onLang = () => applyDetectedLocale();
    window.addEventListener("languagechange", onLang);
    return () => window.removeEventListener("languagechange", onLang);
  }, []);

  const translate = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      t(key, vars, locale),
    [locale],
  );

  return { locale, t: translate, setLocale };
}
