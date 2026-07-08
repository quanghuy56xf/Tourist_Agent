import GroupRouteGuard from "@/components/visitor/GroupRouteGuard";
import MinimapButton from "@/components/visitor/MinimapButton";
import { Suspense } from "react";

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="artifact-shell relative">
      <GroupRouteGuard>{children}</GroupRouteGuard>
      <Suspense fallback={null}>
        <MinimapButton />
      </Suspense>
    </div>
  );
}
