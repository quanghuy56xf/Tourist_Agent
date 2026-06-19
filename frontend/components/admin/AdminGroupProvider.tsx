"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface ActiveGroup {
  id: number;
  name: string;
}

interface AdminGroupContextType {
  activeGroup: ActiveGroup | null;
  setActiveGroup: (group: ActiveGroup | null) => void;
}

const AdminGroupContext = createContext<AdminGroupContextType | undefined>(undefined);

const STORAGE_KEY = "dinov2_active_group";

export function AdminGroupProvider({ children }: { children: ReactNode }) {
  const [activeGroup, setActiveGroupState] = useState<ActiveGroup | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ActiveGroup;
          if (typeof parsed.id === "number" && typeof parsed.name === "string") {
            setActiveGroupState(parsed);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setActiveGroup = (group: ActiveGroup | null) => {
    setActiveGroupState(group);
    if (group) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(group));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AdminGroupContext.Provider value={{ activeGroup, setActiveGroup }}>
      {children}
    </AdminGroupContext.Provider>
  );
}

export function useAdminGroup() {
  const context = useContext(AdminGroupContext);
  if (context === undefined) {
    throw new Error("useAdminGroup must be used within an AdminGroupProvider");
  }
  return context;
}
