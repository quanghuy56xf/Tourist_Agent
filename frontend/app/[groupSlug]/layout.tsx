import GroupRouteGuard from "@/components/visitor/GroupRouteGuard";

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="artifact-shell relative">
      <GroupRouteGuard>{children}</GroupRouteGuard>
    </div>
  );
}
