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

export interface MemoryEntry {
  /** The entry's text without its metadata comments or label. */
  body: string;
  /** A short leading category such as `环境事实` in `环境事实：…`. */
  label?: string;
  /** `created=` from the entry's `<!-- created=…, last=… -->` comment. */
  created?: string;
  /** `last=` from the same comment. */
  last?: string;
}

const METADATA_COMMENT = /<!--([\s\S]*?)-->/g;
const METADATA_FIELD = /(\w+)\s*=\s*([^,\s]+)/g;
// A category is a short word right before a colon, never a URL scheme (`https://`).
const LEADING_LABEL = /^([^\s：:#*`[\]]{1,12})[：:](?!\/\/)\s*/;

/**
 * One memory entry as the viewer shows it. pi-hermes-memory ends each entry
 * with `<!-- created=YYYY-MM-DD, last=YYYY-MM-DD -->`; Markdown drops the
 * comment, so its dates are read here, and the comment is taken out of the body.
 */
export function parseMemoryEntry(entry: string): MemoryEntry {
  const fields: Record<string, string> = {};
  const withoutComments = entry.replace(METADATA_COMMENT, (_match, inner: string) => {
    for (const [, key, value] of inner.matchAll(METADATA_FIELD)) fields[key] = value;
    return "";
  }).trim();
  const labelMatch = LEADING_LABEL.exec(withoutComments);
  const label = labelMatch?.[1];
  const body = labelMatch ? withoutComments.slice(labelMatch[0].length) : withoutComments;
  return {
    body: body.trim(),
    ...(label ? { label } : {}),
    ...(fields.created ? { created: fields.created } : {}),
    ...(fields.last ? { last: fields.last } : {}),
  };
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
