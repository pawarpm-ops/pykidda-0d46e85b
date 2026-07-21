import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { pykoChat } from "@/lib/pyko/router.functions";
import { getPykoEnabledModes, type PykoEnabledModes } from "@/lib/pyko/flags.functions";
import { PykoMessage } from "@/components/PykoMessage";
import { PYKO_NAVIGATION_ROUTES, type PykoAction } from "@/lib/pyko/navigation";
import pykoMascot from "@/assets/pyko-mascot.png.asset.json";

type SubMode = "guide" | "tutor" | "corrector" | "coach";
type StudentMode = "guide" | "tutor" | "allrounder";
type Msg = { id: string; role: "user" | "assistant"; content: string; subMode?: SubMode };

const POS_KEY = "pykidda:pyko-pos";
const MODE_KEY = "pykidda:pyko-mode";

const MODE_META: Record<StudentMode, { icon: string; label: string; desc: string; accent: string }> = {
  guide:      { icon: "🧭", label: "Guide",      desc: "Learn how to use PY Kidda.",                        accent: "from-sky-500 to-indigo-500" },
  tutor:      { icon: "👨‍🏫", label: "AI Teacher", desc: "Understand Python and correct your code.",         accent: "from-emerald-500 to-teal-500" },
  allrounder: { icon: "✨", label: "All-Rounder", desc: "Navigation, learning, code help and progress.",     accent: "from-fuchsia-500 to-orange-500" },
};

const SUBMODE_LABEL: Record<SubMode, string> = {
  guide: "🧭 Guide response",
  tutor: "👨‍🏫 Teaching response",
  corrector: "🛠 Code correction",
  coach: "📈 Progress guidance",
};

// Panel hides itself entirely on routes that host an in-progress assessment.
// Belt-and-suspenders: the server also blocks Pyko while a session is active.
function isAssessmentRoute(path: string): boolean {
  return (
    /^\/mock-tests\/[^/]+\/run\b/.test(path) ||
    /^\/mock-tests\/ai\/[^/]+\/take\b/.test(path)
  );
}

export function PykoFloatingPanel() {
  const chat = useServerFn(pykoChat);
  const loadFlags = useServerFn(getPykoEnabledModes);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onAssessment = isAssessmentRoute(pathname);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<"normal" | "min" | "max">("normal");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<StudentMode>("guide");
  const [flags, setFlags] = useState<PykoEnabledModes>({ master: true, guide: true, tutor: true, allrounder: true });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MODE_KEY);
      if (raw === "guide" || raw === "tutor" || raw === "allrounder") setMode(raw);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    loadFlags().then((f) => {
      setFlags(f);
      // If the persisted mode is now disabled, snap to the first enabled one.
      setMode((cur) => {
        if (f[cur]) return cur;
        const order: StudentMode[] = ["guide", "tutor", "allrounder"];
        return order.find((k) => f[k]) ?? cur;
      });
    }).catch(() => { /* keep permissive defaults */ });
  }, [loadFlags]);
  const [err, setErr] = useState<string | null>(null);
  const [lastUserText, setLastUserText] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 1024, h: 768 });
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean; w: number; h: number; startX: number; startY: number } | null>(null);

  // Escape closes the panel; focus returns to launcher.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Restore focus to launcher when panel closes.
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      setTimeout(() => launcherRef.current?.focus(), 40);
    }
    prevOpen.current = open;
  }, [open]);

  // Force-close if we entered an active assessment route.
  useEffect(() => {
    if (onAssessment && open) setOpen(false);
  }, [onAssessment, open]);

  useEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPos(parsed);
          return;
        }
      }
    } catch {
      // Malformed storage — ignore.
    }
    setPos({ x: 24, y: Math.max(80, window.innerHeight - 180) });
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open && size !== "min") {
      // Focus input for accessibility.
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, size]);

  const clamp = (x: number, y: number, w: number, h: number) => {
    const maxX = viewport.w - w - 4;
    const maxY = viewport.h - h - 4;
    return { x: Math.max(4, Math.min(x, maxX)), y: Math.max(4, Math.min(y, maxY)) };
  };

  const panelDims = useMemo(() => {
    const baseW = size === "max" ? 760 : 360;
    const baseH = size === "max" ? 880 : 520;
    const w = Math.min(baseW, viewport.w - 8);
    const h = Math.min(size === "min" ? 48 : baseH, viewport.h - 8);
    return { w, h };
  }, [size, viewport]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      moved: false,
      w: rect.width,
      h: rect.height,
      startX: e.clientX,
      startY: e.clientY,
    };
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
    d.moved = true;
    setPos(clamp(e.clientX - d.dx, e.clientY - d.dy, d.w, d.h));
  };
  const endDrag = (e: React.PointerEvent<HTMLElement>, toggleOnClick: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (pos && d?.moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* noop */ }
    }
    if (d && !d.moved && toggleOnClick) setOpen((o) => !o);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => endDrag(e, true);
  const onPointerUpHeader = (e: React.PointerEvent<HTMLElement>) => endDrag(e, false);

  const doSend = async (text: string, retry: boolean) => {
    setErr(null);
    setBusy(true);
    if (!retry) {
      const userMsg: Msg = { id: `u_${Date.now()}`, role: "user", content: text };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLastUserText(text);
    }
    try {
      const res = await chat({
        data: {
          conversationId: convId,
          mode,
          message: text.slice(0, 4000),
          pageContext: { route: pathname.slice(0, 200) },
          retry,
        },
      });
      setConvId(res.conversationId);
      const sub = (res as { subMode?: SubMode }).subMode;
      setMessages((m) => [...m, { id: res.messageId, role: "assistant", content: res.content, subMode: sub }]);
      setLastUserText(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Pyko is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    void doSend(text, false);
  };

  const retry = () => {
    if (!lastUserText || busy) return;
    void doSend(lastUserText, true);
  };

  const newConversation = () => {
    setConvId(undefined);
    setMessages([]);
    setErr(null);
    setLastUserText(null);
  };

  const handleNavigate = (action: PykoAction) => {
    const entry = PYKO_NAVIGATION_ROUTES[action.routeKey];
    if (!entry) return;
    // Minimise the panel so it doesn't cover the destination.
    setSize("min");
    setOpen(false);
    // Analytics: safe metadata only — no message text, no PII.
    try {
      // eslint-disable-next-line no-console
      console.debug("[pyko:nav]", {
        routeKey: action.routeKey,
        mode,
        from: pathname,
        at: Date.now(),
      });
    } catch { /* ignore */ }
    void navigate({ to: entry.route, hash: entry.hash }).then(() => {
      // Move focus to the destination heading for accessibility.
      setTimeout(() => {
        const h = document.querySelector<HTMLElement>("h1, [role='heading']");
        h?.focus?.();
      }, 120);
    });
  };


  const switchMode = (next: StudentMode) => {
    if (next === mode) return;
    if (!flags[next]) return;
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* ignore */ }
    // Switching mode starts a fresh conversation so instructions never mix.
    newConversation();
  };

  if (!pos) return null;
  if (onAssessment) return null;

  const adj = clamp(pos.x, pos.y, panelDims.w, panelDims.h);

  return (
    <>
      {!open && (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="Open Pyko AI (draggable)"
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
          className="fixed z-40 flex h-16 w-16 items-center justify-center rounded-full hover:scale-110 transition select-none"
        >
          <img draggable={false} src={pykoMascot.url} alt="Pyko" className="h-full w-full object-contain pointer-events-none animate-[pyko-thinking_1.6s_ease-in-out_infinite]" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Pyko AI"
          style={{ left: adj.x, top: adj.y, width: panelDims.w, height: panelDims.h }}
          className="fixed z-40 flex max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUpHeader}
            style={{ backgroundImage: "var(--gradient-sunrise, linear-gradient(135deg,#f97316,#ef4444))", touchAction: "none", cursor: "move" }}
            className="flex items-center justify-between border-b border-border px-3 py-2 select-none"
          >
            <div className="text-primary-foreground">
              <p className="text-sm font-bold">Pyko AI</p>
              <p className="text-[10px] opacity-90">{MODE_META[mode].icon} {MODE_META[mode].label} · beta</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => { e.stopPropagation(); newConversation(); }}
                onClick={(e) => e.stopPropagation()}
                className="text-primary-foreground text-[11px] leading-none px-2 py-1 rounded hover:opacity-80 border border-primary-foreground/30"
                aria-label="Start a new Pyko conversation"
                title="New chat"
              >
                New
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => { e.stopPropagation(); setSize((s) => (s === "min" ? "normal" : "min")); }}
                onClick={(e) => e.stopPropagation()}
                className="text-primary-foreground text-lg leading-none px-2 hover:opacity-80"
                aria-label={size === "min" ? "Restore Pyko" : "Minimize Pyko"}
                title={size === "min" ? "Restore" : "Minimize"}
              >
                {size === "min" ? "▢" : "—"}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => { e.stopPropagation(); setSize((s) => (s === "max" ? "normal" : "max")); }}
                onClick={(e) => e.stopPropagation()}
                className="text-primary-foreground text-lg leading-none px-2 hover:opacity-80"
                aria-label={size === "max" ? "Restore Pyko" : "Maximize Pyko"}
                title={size === "max" ? "Restore" : "Maximize"}
              >
                {size === "max" ? "🗗" : "🗖"}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => { e.stopPropagation(); setOpen(false); }}
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="text-primary-foreground text-xl leading-none px-2 hover:opacity-80"
                aria-label="Close Pyko"
              >
                ×
              </button>
            </div>
          </div>
          {size !== "min" && (<>
            <div className="border-b border-border bg-muted/30 px-2 py-2">
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(MODE_META) as StudentMode[]).map((k) => {
                  const meta = MODE_META[k];
                  const active = mode === k;
                  const enabled = flags[k];
                  return (
                    <button
                      key={k}
                      onClick={() => switchMode(k)}
                      disabled={busy || !enabled}
                      title={enabled ? meta.desc : `${meta.label} is disabled by the admin.`}
                      aria-pressed={active}
                      className={`relative rounded-md px-1.5 py-1 text-[10px] font-semibold leading-tight border transition ${
                        !enabled
                          ? "bg-muted/40 text-muted-foreground border-dashed border-border opacity-60 cursor-not-allowed"
                          : active
                            ? `bg-gradient-to-br ${meta.accent} text-white border-transparent shadow`
                            : "bg-background text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      <div className="text-sm leading-none">{meta.icon}</div>
                      <div className="mt-0.5">{meta.label}</div>
                      {!enabled && <div className="mt-0.5 text-[8px] uppercase tracking-wide">off</div>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground text-center">{MODE_META[mode].desc}</p>
            </div>
            <div
              ref={bodyRef}
              aria-live="polite"
              className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/50"
            >
              {messages.length === 0 && (
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>Hi! I'm Pyko. I can help you find your way around PY Kidda.</p>
                  <p className="font-semibold text-foreground">Try asking:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Where do I see my homework?</li>
                    <li>How do streaks work?</li>
                    <li>How do I take a mock test?</li>
                  </ul>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}>
                  {m.role === "assistant" && mode === "allrounder" && m.subMode && (
                    <span className="mb-0.5 text-[10px] font-semibold text-muted-foreground">{SUBMODE_LABEL[m.subMode]}</span>
                  )}
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                        : "border border-border/60 bg-card text-foreground"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <PykoMessage
                        content={m.content}
                        onSuggestion={(p) => {
                          setInput(p);
                          inputRef.current?.focus();
                        }}
                        onNavigate={handleNavigate}
                      />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="mr-auto flex items-center gap-2 max-w-[85%] rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  <img
                    src={pykoMascot.url}
                    alt=""
                    className="h-5 w-5 object-contain animate-[pyko-thinking_1.4s_ease-in-out_infinite]"
                  />
                  <span className="animate-pulse">Pyko is thinking…</span>
                </div>
              )}
              {err && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <p className="text-[11px] text-destructive">{err}</p>
                  {lastUserText && (
                    <button
                      onClick={retry}
                      disabled={busy}
                      className="text-[11px] font-semibold text-destructive underline disabled:opacity-50"
                      aria-label="Retry the last Pyko request"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border p-2">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask Pyko about PY Kidda…"
                  disabled={busy}
                  aria-label="Message to Pyko"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  aria-label="Send message"
                >
                  Send
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Chats may be stored to improve Pyko. Don't share sensitive info.
              </p>
            </div>
          </>)}
        </div>
      )}
    </>
  );
}
