import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { SyncBanner } from "@/components/SyncBanner";
import { SideRail, TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="mx-auto flex min-h-full w-full max-w-[480px] gap-8 pt-[max(env(safe-area-inset-top,0px),0.75rem)] min-[900px]:max-w-[728px] min-[900px]:px-4 min-[900px]:pt-6">
        <SideRail />
        <div className="flex min-w-0 flex-1 flex-col min-[900px]:max-w-[480px]">
          <SyncBanner />
          <main className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] min-[900px]:px-0 min-[900px]:pb-10">{children}</main>
        </div>
      </div>
      <TabBar />
    </AuthGate>
  );
}
