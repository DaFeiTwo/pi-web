"use client";

import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";
import { hermesMemoryText } from "@/lib/hermes-memory/messages";

/**
 * The sidebar footer's Memory button (fork-only feature), styled as its
 * Models / Skills / Settings neighbours. A link, so it can open in a new tab.
 */
export function MemoryEntryButton() {
  const { locale } = useI18n();
  const label = hermesMemoryText(locale, "entry");
  return (
    <Link
      href="/memory"
      title={label}
      aria-label={label}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        height: 32, padding: 0, background: "none", border: "none",
        borderRadius: 9, color: "var(--text-muted)", cursor: "pointer",
        fontSize: 12, textDecoration: "none",
        transition: "background 0.12s, color 0.12s",
      }}
      onMouseEnter={(event) => { event.currentTarget.style.background = "var(--bg-hover)"; event.currentTarget.style.color = "var(--text)"; }}
      onMouseLeave={(event) => { event.currentTarget.style.background = "none"; event.currentTarget.style.color = "var(--text-muted)"; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
