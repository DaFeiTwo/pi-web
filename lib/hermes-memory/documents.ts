/**
 * Client-safe shapes and helpers for the pi-hermes-memory viewer (fork-only
 * feature). The server reads the files (lib/hermes-memory/server.ts); nothing
 * here touches the filesystem.
 */

/** The only documents the viewer reads. The browser sends no file names or paths. */
export const HERMES_MEMORY_DOCUMENTS = [
  { id: "memory", fileName: "MEMORY.md" },
  { id: "user", fileName: "USER.md" },
  { id: "failures", fileName: "failures.md" },
] as const;

export type HermesMemoryDocumentId = typeof HERMES_MEMORY_DOCUMENTS[number]["id"];

export type HermesMemoryDocumentError = "too_large" | "unreadable";

export interface HermesMemoryDocument {
  id: HermesMemoryDocumentId;
  fileName: string;
  exists: boolean;
  size?: number;
  /** ISO time of the file's last change. */
  mtime?: string;
  content?: string;
  error?: HermesMemoryDocumentError;
}

export interface HermesMemoryResponse {
  /** Whether the plugin's storage directory exists. */
  available: boolean;
  documents: HermesMemoryDocument[];
  /** ISO time the server read the files. */
  readAt: string;
}

/**
 * The entries of a memory file. pi-hermes-memory separates entries with a
 * line holding only `§`; a file without one is a single entry.
 */
export function splitMemoryEntries(content: string): string[] {
  const normalized = content.replace(/\r\n?/g, "\n");
  if (!normalized.includes("§")) {
    const whole = normalized.trim();
    return whole ? [whole] : [];
  }
  return normalized
    .split(/\n?§\n?/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Memory text is written by a model from conversations, so an image in it
 * must not make the browser fetch a remote address. Markdown images become
 * links and raw `<img>` tags show as text.
 */
export function neutralizeMemoryMedia(markdown: string): string {
  return markdown
    .replace(/!\[/g, "[")
    .replace(/<(img|video|audio|source|picture|iframe)\b/gi, "&lt;$1");
}
