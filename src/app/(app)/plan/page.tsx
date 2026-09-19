import type { Metadata } from "next";
import { PlanScreen } from "@/components/screens/PlanScreen";

export const metadata: Metadata = { title: "Plan" };

export default function Page() {
  return <PlanScreen />;
}
