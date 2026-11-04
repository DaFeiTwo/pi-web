import { statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { parseJsonc } from "@/lib/jsonc";
import { isExistingPathWithinRoots } from "@/lib/path-security";
import { readRegularFileText } from "@/lib/regular-file";
import {
  HERMES_MEMORY_DOCUMENTS,
  type HermesMemoryDocument,
  type HermesMemoryResponse,
} from "./documents";

/** Each core memory file is a few KB; this only stops a runaway file from blocking the server. */
export const HERMES_MEMORY_MAX_BYTES = 1024 * 1024;
const CONFIG_MAX_BYTES = 256 * 1024;
const DEFAULT_DIR_NAME = "pi-hermes-memory";
const CONFIG_FILE_NAME = "hermes-memory-config.json";

function expandHome(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(homedir(), value.slice(2));
  return value;
}

/**
 * The plugin's storage directory: `memoryDir` from its config file in the
 * agent directory, as the plugin resolves it, else `<agentDir>/pi-hermes-memory`.
 * The config is written by whoever runs the server, so its path is trusted
 * as the plugin trusts it.
 */
export function resolveHermesMemoryDir(agentDir = getAgentDir()): string {
  const fallback = path.join(agentDir, DEFAULT_DIR_NAME);
  try {
    const text = readRegularFileText(path.join(agentDir, CONFIG_FILE_NAME), CONFIG_MAX_BYTES);
    if (text === undefined) return fallback;
    const config = parseJsonc(text) as { memoryDir?: unknown } | null;
    const memoryDir = typeof config?.memoryDir === "string" ? config.memoryDir.trim() : "";
    if (!memoryDir) return fallback;
    const expanded = expandHome(memoryDir);
    return path.isAbsolute(expanded) ? expanded : path.resolve(agentDir, expanded);
  } catch {
    return fallback;
  }
}

function isDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function readDocument(root: string, id: HermesMemoryDocument["id"], fileName: string): HermesMemoryDocument {
  const target = path.join(root, fileName);
  let stats;
  try {
    stats = statSync(target);
  } catch {
    return { id, fileName, exists: false };
  }
  const info = { id, fileName, exists: true, size: stats.size, mtime: stats.mtime.toISOString() };
  // A fixed name can still be a link out of the plugin's directory.
  if (!stats.isFile() || !isExistingPathWithinRoots(target, new Set([root]))) {
    return { ...info, error: "unreadable" };
  }
  if (stats.size > HERMES_MEMORY_MAX_BYTES) return { ...info, error: "too_large" };
  try {
    const content = readRegularFileText(target, HERMES_MEMORY_MAX_BYTES);
    if (content === undefined) return { id, fileName, exists: false };
    return { ...info, content: content.replace(/^\uFEFF/, "") };
  } catch (error) {
    // Errors name the server path; the browser gets a code only.
    const tooLarge = error instanceof Error && error.message.includes("larger than");
    return { ...info, error: tooLarge ? "too_large" : "unreadable" };
  }
}

/** The three core memory documents, read-only. */
export function readHermesMemory(root = resolveHermesMemoryDir()): HermesMemoryResponse {
  const available = isDirectory(root);
  const documents = HERMES_MEMORY_DOCUMENTS.map(({ id, fileName }) => (
    available ? readDocument(root, id, fileName) : { id, fileName, exists: false }
  ));
  return { available, documents, readAt: new Date().toISOString() };
}
