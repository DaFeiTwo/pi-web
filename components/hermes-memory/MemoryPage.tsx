"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownBody } from "@/components/MarkdownBody";
import { useFontPreferences } from "@/hooks/useFontPreferences";
import { useI18n } from "@/hooks/useI18n";
import {
  HERMES_MEMORY_DOCUMENTS,
  neutralizeMemoryMedia,
  splitMemoryEntries,
  type HermesMemoryDocument,
  type HermesMemoryDocumentId,
  type HermesMemoryResponse,
} from "@/lib/hermes-memory/documents";
import { hermesMemoryText, type HermesMemoryMessageKey } from "@/lib/hermes-memory/messages";
import "./memory-page.css";

type ViewMode = "entries" | "raw";

const TAB_QUERY = "tab";

function isDocumentId(value: string | null): value is HermesMemoryDocumentId {
  return HERMES_MEMORY_DOCUMENTS.some((doc) => doc.id === value);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}

export function MemoryPage() {
  useFontPreferences();
  const router = useRouter();
  const { locale } = useI18n();
  const text = useCallback(
    (key: HermesMemoryMessageKey, params?: Record<string, string | number>) => hermesMemoryText(locale, key, params),
    [locale],
  );
  const [data, setData] = useState<HermesMemoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<HermesMemoryDocumentId>("memory");
  const [view, setView] = useState<ViewMode>("entries");
  const abortRef = useRef<AbortController | null>(null);

  const formatTime = useCallback((iso: string) => new Date(iso).toLocaleString(locale), [locale]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch("/api/hermes-memory", { cache: "no-store", signal: controller.signal });
      if (response.status === 401) {
        window.location.replace(`/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
        return;
      }
      const body = await response.json() as HermesMemoryResponse & { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? `HTTP ${response.status}`);
      setData(body);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  // The tab follows the URL, so a reload or a shared link keeps it.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get(TAB_QUERY);
    if (isDocumentId(tab)) setActive(tab);
  }, []);

  const selectTab = (id: HermesMemoryDocumentId) => {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === "memory") url.searchParams.delete(TAB_QUERY);
    else url.searchParams.set(TAB_QUERY, id);
    window.history.replaceState(window.history.state, "", url);
  };

  // The plugin writes in the background: read again when the page comes back into view.
  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      abortRef.current?.abort();
    };
  }, [load]);

  const documents = useMemo(() => new Map((data?.documents ?? []).map((doc) => [doc.id, doc])), [data]);
  const current = documents.get(active);

  const goBack = () => {
    // Back to the chat this page was opened from, with its session in the URL.
    if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/");
    }
  };

  return (
    <main className="hm-page">
      <header className="hm-header">
        <button type="button" className="hm-icon-button" onClick={goBack} aria-label={text("back")} title={text("back")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="hm-heading">
          <h1>{text("title")}</h1>
          <p>{text("subtitle")}</p>
        </div>
        <button
          type="button"
          className="hm-button"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? text("refreshing") : text("refresh")}
        </button>
      </header>

      <div className="hm-body">
        <div role="tablist" aria-label={text("title")} className="hm-tabs">
          {HERMES_MEMORY_DOCUMENTS.map(({ id }) => {
            const doc = documents.get(id);
            const count = doc?.content !== undefined ? splitMemoryEntries(doc.content).length : null;
            const selected = id === active;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`hm-tab${selected ? " is-active" : ""}`}
                onClick={() => selectTab(id)}
              >
                <span>{text(`tab.${id}`)}</span>
                {count !== null && <span className="hm-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {error && <div className="hm-notice is-error" role="alert">{text("loadFailed", { error })}</div>}

        {data && !data.available ? (
          <div className="hm-notice">{text("notInstalled")}</div>
        ) : current ? (
          <DocumentView doc={current} view={view} onViewChange={setView} text={text} formatTime={formatTime} />
        ) : null}

        {data && <footer className="hm-footer">{text("readAt", { time: formatTime(data.readAt) })}</footer>}
      </div>
    </main>
  );
}

function DocumentView({
  doc,
  view,
  onViewChange,
  text,
  formatTime,
}: {
  doc: HermesMemoryDocument;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  text: (key: HermesMemoryMessageKey, params?: Record<string, string | number>) => string;
  formatTime: (iso: string) => string;
}) {
  const entries = useMemo(() => (doc.content !== undefined ? splitMemoryEntries(doc.content) : []), [doc.content]);
  const file = doc.fileName;

  let body;
  if (!doc.exists) body = <div className="hm-notice">{text("missingFile", { file })}</div>;
  else if (doc.error === "too_large") body = <div className="hm-notice is-error">{text("tooLarge", { file })}</div>;
  else if (doc.error) body = <div className="hm-notice is-error">{text("unreadable", { file })}</div>;
  else if (entries.length === 0) body = <div className="hm-notice">{text("emptyFile", { file })}</div>;
  else if (view === "raw") body = <pre className="hm-raw">{doc.content}</pre>;
  else body = (
    <ol className="hm-entries">
      {entries.map((entry, index) => (
        <li key={index} className="hm-entry">
          <span className="hm-entry-index" aria-hidden="true">{index + 1}</span>
          <MarkdownBody className="hm-entry-body">{neutralizeMemoryMedia(entry)}</MarkdownBody>
        </li>
      ))}
    </ol>
  );

  return (
    <section className="hm-document" aria-label={text(`tab.${doc.id}`)}>
      <p className="hm-description">{text(`description.${doc.id}`)}</p>
      <div className="hm-meta">
        <span className="hm-meta-file">{file}</span>
        {doc.content !== undefined && (
          <span>{entries.length === 1 ? text("entryOne") : text("entries", { count: entries.length })}</span>
        )}
        {doc.size !== undefined && <span>{formatSize(doc.size)}</span>}
        {doc.mtime && <span>{text("updatedAt", { time: formatTime(doc.mtime) })}</span>}
        {doc.content !== undefined && entries.length > 0 && (
          <span className="hm-view-switch" role="group">
            {(["entries", "raw"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                className={view === mode ? "is-active" : undefined}
                onClick={() => onViewChange(mode)}
              >
                {text(mode === "entries" ? "viewEntries" : "viewRaw")}
              </button>
            ))}
          </span>
        )}
      </div>
      {body}
    </section>
  );
}
