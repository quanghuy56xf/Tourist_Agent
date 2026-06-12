export interface ActiveGroup {
  id: number;
  name: string;
}

const STORAGE_KEY = "dinov2_active_group";

export function getActiveGroup(): ActiveGroup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveGroup;
    if (typeof parsed.id === "number" && typeof parsed.name === "string") {
      return parsed;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function setActiveGroup(group: ActiveGroup): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(group));
  window.dispatchEvent(new CustomEvent("active-group-changed", { detail: group }));
}

export function clearActiveGroup(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("active-group-changed", { detail: null }));
}
