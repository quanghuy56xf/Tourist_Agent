import GroupRouteGuard from "@/components/visitor/GroupRouteGuard";

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return <GroupRouteGuard>{children}</GroupRouteGuard>;
}
