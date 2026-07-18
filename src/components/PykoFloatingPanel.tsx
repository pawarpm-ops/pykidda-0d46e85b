import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { pykoChat } from "@/lib/pyko/router.functions";
import pykoMascot from "@/assets/pyko-mascot.png.asset.json";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const POS_KEY = "pykidda:pyko-pos";

export function PykoFloatingPanel() {
  const chat = useServerFn(pykoChat);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<string | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean; w: number; h: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) { setPos(JSON.parse(raw)); return; }
    } catch {}
    setPos({ x: 24, y: Math.max(80, window.innerHeight - 180) });
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const clamp = (x: number, y: number, w: number, h: number) => {
    const maxX = window.innerWidth - w - 4;
    const maxY = window.innerHeight - h - 4;
    return { x: Math.max(4, Math.min(x, maxX)), y: Math.max(4, Math.min(y, maxY)) };
  };

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
    try { el.setPointerCapture(e.pointerId); } catch {}
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
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (pos && d?.moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
    }
    if (d && !d.moved && toggleOnClick) setOpen((o) => !o);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => endDrag(e, true);
  const onPointerUpHeader = (e: React.PointerEvent<HTMLElement>) => endDrag(e, false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null);
    setBusy(true);
    const userMsg: Msg = { id: `u_${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    try {
      const res = await chat({
        data: {
          conversationId: convId,
          mode: "guide",
          message: text.slice(0, 4000),
          pageContext: { route: pathname.slice(0, 200) },
        },
      });
      setConvId(res.conversationId);
      setMessages((m) => [...m, { id: res.messageId, role: "assistant", content: res.content }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Pyko is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  if (!pos) return null;

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

      {open && (() => {
        const panelW = Math.min(360, window.innerWidth - 8);
        const panelH = Math.min(520, window.innerHeight - 8);
        const adj = clamp(pos.x, pos.y, panelW, panelH);
        return (
        <div style={{ left: adj.x, top: adj.y }} className="fixed z-40 flex h-[520px] w-[360px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">

          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUpHeader}
            style={{ backgroundImage: "var(--gradient-sunrise, linear-gradient(135deg,#f97316,#ef4444))", touchAction: "none", cursor: "move" }}
            className="flex items-center justify-between border-b border-border px-3 py-2 select-none"
          >
            <div className="text-primary-foreground">
              <p className="text-sm font-bold">Pyko AI</p>
              <p className="text-[10px] opacity-90">Website guide · beta</p>
            </div>
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

          <div ref={bodyRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/50">
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
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                }`}
              >
                {m.content}
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
            {err && <p className="text-[11px] text-destructive">{err}</p>}
          </div>

          <div className="border-t border-border p-2">
            <div className="flex gap-2">
              <input
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
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Pyko may make mistakes. Check important info.</p>
          </div>
        </div>
      )}
    </>
  );
}
