import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { OnboardingScreen } from "@/components/screens/OnboardingScreen";

export const metadata: Metadata = { title: "Get started" };

export default function Page() {
  return (
    <AuthGate requireOnboarding={false}>
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-4 pb-10 pt-4 safe-top">
        <OnboardingScreen />
      </div>
    </AuthGate>
  );
}
