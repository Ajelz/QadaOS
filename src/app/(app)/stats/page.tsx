import type { Metadata } from "next";
import { StatsScreen } from "@/components/screens/StatsScreen";

export const metadata: Metadata = { title: "Stats" };

export default function Page() {
  return <StatsScreen />;
}
