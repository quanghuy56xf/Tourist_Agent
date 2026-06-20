import GroupRouteGuard from "@/components/visitor/GroupRouteGuard";
import MinimapButton from "@/components/visitor/MinimapButton";

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="artifact-shell relative">
      <GroupRouteGuard>
        {children}
        <MinimapButton />
      </GroupRouteGuard>
    </div>
  );
}
