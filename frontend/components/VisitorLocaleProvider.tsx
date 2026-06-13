"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  backendLanguageForLocale,
  DEFAULT_LOCALE,
  readStoredLocale,
  translations,
  VisitorLocale,
  VisitorTranslations,
  writeStoredLocale,
} from "@/lib/i18n";

type VisitorLocaleContextValue = {
  locale: VisitorLocale;
  language: "Tiếng Việt" | "Tiếng Anh";
  t: VisitorTranslations;
  ready: boolean;
  setLocale: (locale: VisitorLocale) => void;
};

const VisitorLocaleContext = createContext<VisitorLocaleContextValue | null>(
  null
);

export function VisitorLocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<VisitorLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale(window.localStorage));
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<VisitorLocaleContextValue>(
    () => ({
      locale,
      language: backendLanguageForLocale(locale),
      t: translations[locale],
      ready,
      setLocale: (next) => {
        setLocaleState(next);
        writeStoredLocale(window.localStorage, next);
      },
    }),
    [locale, ready]
  );

  return (
    <VisitorLocaleContext.Provider value={value}>
      {children}
    </VisitorLocaleContext.Provider>
  );
}

export function useVisitorLocale(): VisitorLocaleContextValue {
  const context = useContext(VisitorLocaleContext);
  if (!context) {
    throw new Error(
      "useVisitorLocale must be used within VisitorLocaleProvider"
    );
  }
  return context;
}
