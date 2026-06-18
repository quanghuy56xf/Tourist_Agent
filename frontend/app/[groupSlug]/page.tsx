"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGroupPath } from "@/lib/useGroupPath";

export default function GroupHomePage() {
  const router = useRouter();
  const groupMethodPath = useGroupPath("/method");

  useEffect(() => {
    router.replace(groupMethodPath);
  }, [groupMethodPath, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{
          borderColor: "var(--primary)",
          borderTopColor: "transparent",
        }}
      />
    </div>
  );
}
