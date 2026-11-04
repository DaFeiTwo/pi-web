import type { Metadata } from "next";
import { MemoryPage } from "@/components/hermes-memory/MemoryPage";
import { I18nProvider } from "@/hooks/useI18n";

export const metadata: Metadata = { title: "Memory - Pi Web" };

// The pi-hermes-memory viewer (fork-only feature). The data comes from
// /api/hermes-memory; proxy.ts puts this page behind the web password too.
export default function Memory() {
  return (
    <I18nProvider>
      <MemoryPage />
    </I18nProvider>
  );
}
