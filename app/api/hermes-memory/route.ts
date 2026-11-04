import { NextResponse } from "next/server";
import { readHermesMemory } from "@/lib/hermes-memory/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/hermes-memory: the pi-hermes-memory plugin's MEMORY.md, USER.md and
// failures.md, read-only. Fork-only feature. The documents are fixed on the
// server; the request carries no path, and the answer names none.
export async function GET() {
  try {
    return NextResponse.json(readHermesMemory(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Memory could not be read" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
