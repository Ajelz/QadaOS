import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { SyncBanner } from "@/components/SyncBanner";
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col safe-top">
        <div className="pt-2">
          <SyncBanner />
        </div>
        <main className="flex-1 px-4 pb-32 pt-2">{children}</main>
      </div>
      <TabBar />
    </AuthGate>
  );
}
