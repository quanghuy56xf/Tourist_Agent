export const VISITOR_PERSONAS = [
  "Mặc định",
  "Family Visitor",
  "Gen Z Explorer",
] as const;

export type VisitorPersona = (typeof VISITOR_PERSONAS)[number];

export const DEFAULT_VISITOR_PERSONA: VisitorPersona = "Mặc định";
export const VISITOR_PERSONA_SESSION_KEY = "hera_visitor_persona";
export const LEGACY_VISITOR_PERSONA_KEY = "user_persona";

export function normalizeVisitorPersona(
  value: string | null
): VisitorPersona {
  return VISITOR_PERSONAS.includes(value as VisitorPersona)
    ? (value as VisitorPersona)
    : DEFAULT_VISITOR_PERSONA;
}

export function readSessionPersona(
  storage: Pick<Storage, "getItem">
): VisitorPersona {
  return normalizeVisitorPersona(
    storage.getItem(VISITOR_PERSONA_SESSION_KEY)
  );
}

export function writeSessionPersona(
  storage: Pick<Storage, "setItem">,
  persona: VisitorPersona
): void {
  storage.setItem(VISITOR_PERSONA_SESSION_KEY, persona);
}

export function startVisitorSession(
  sessionStorage: Pick<Storage, "setItem">,
  localStorage: Pick<Storage, "removeItem">
): void {
  try {
    writeSessionPersona(sessionStorage, DEFAULT_VISITOR_PERSONA);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  try {
    localStorage.removeItem(LEGACY_VISITOR_PERSONA_KEY);
  } catch {
    // Legacy cleanup must not block the visitor journey.
  }
}
