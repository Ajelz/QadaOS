import type { Metadata } from "next";
import { LogScreen } from "@/components/screens/LogScreen";

export const metadata: Metadata = { title: "Log" };

export default function Page() {
  return <LogScreen />;
}
