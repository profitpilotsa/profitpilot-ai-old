import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SupportedLocale = "ar" | "en";
type LocaleContextValue = { locale: SupportedLocale; direction: "rtl" | "ltr"; setLocale(locale: SupportedLocale): void };
const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/** Shared foundation only. Feature copy is migrated deliberately, not translated ad hoc. */
export function LocaleProvider({ children, defaultLocale = "en" }: { children: ReactNode; defaultLocale?: SupportedLocale }) {
  const [locale, setLocale] = useState<SupportedLocale>(defaultLocale);
  const direction: "rtl" | "ltr" = locale === "ar" ? "rtl" : "ltr";
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = direction; }, [locale, direction]);
  const value = useMemo(() => ({ locale, direction, setLocale }), [locale, direction]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale() { const value = useContext(LocaleContext); if (!value) throw new Error("useLocale must be used within LocaleProvider"); return value; }
