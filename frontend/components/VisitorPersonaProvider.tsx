"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_VISITOR_PERSONA,
  LEGACY_VISITOR_PERSONA_KEY,
  readSessionPersona,
  VisitorPersona,
  writeSessionPersona,
} from "@/lib/visitorPersona";

type VisitorPersonaContextValue = {
  persona: VisitorPersona;
  ready: boolean;
  setPersona: (persona: VisitorPersona) => void;
};

const VisitorPersonaContext =
  createContext<VisitorPersonaContextValue | null>(null);

export function VisitorPersonaProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [persona, setPersonaState] = useState<VisitorPersona>(
    DEFAULT_VISITOR_PERSONA
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setPersonaState(readSessionPersona(window.sessionStorage));
      window.localStorage.removeItem(LEGACY_VISITOR_PERSONA_KEY);
    } catch {
      setPersonaState(DEFAULT_VISITOR_PERSONA);
    } finally {
      setReady(true);
    }
  }, []);

  const value = useMemo<VisitorPersonaContextValue>(
    () => ({
      persona,
      ready,
      setPersona: (next) => {
        setPersonaState(next);
        try {
          writeSessionPersona(window.sessionStorage, next);
        } catch {
          // Keep the in-memory choice when browser storage is unavailable.
        }
      },
    }),
    [persona, ready]
  );

  return (
    <VisitorPersonaContext.Provider value={value}>
      {children}
    </VisitorPersonaContext.Provider>
  );
}

export function useVisitorPersona(): VisitorPersonaContextValue {
  const context = useContext(VisitorPersonaContext);
  if (!context) {
    throw new Error(
      "useVisitorPersona must be used within VisitorPersonaProvider"
    );
  }
  return context;
}
