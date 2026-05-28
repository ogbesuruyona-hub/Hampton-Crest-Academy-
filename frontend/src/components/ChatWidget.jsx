import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "hc_chat_session_id";

const TypingDots = () => (
  <div className="flex items-center gap-1 px-1 py-1">
    <span className="h-1.5 w-1.5 rounded-full bg-[var(--hc-gold)] animate-pulse" />
    <span
      className="h-1.5 w-1.5 rounded-full bg-[var(--hc-gold)] animate-pulse"
      style={{ animationDelay: "150ms" }}
    />
    <span
      className="h-1.5 w-1.5 rounded-full bg-[var(--hc-gold)] animate-pulse"
      style={{ animationDelay: "300ms" }}
    />
  </div>
);

const Bubble = ({ role, content }) => {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        data-testid={`chat-msg-${role}`}
        className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed tracking-tight whitespace-pre-wrap ${
          mine
            ? "bg-[var(--hc-platinum)] text-[var(--hc-bg)]"
            : "bg-[var(--hc-surface-elevated)] text-[var(--hc-text)] border border-[var(--hc-border)]"
        }`}
      >
        {content}
      </div>
    </div>
  );
};

export const ChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Load prior history on first open (if session exists)
  useEffect(() => {
    if (!open || historyLoaded || !sessionId) {
      if (open && !sessionId) setHistoryLoaded(true);
      return;
    }
    api
      .get("/chat/history", { params: { session_id: sessionId } })
      .then(({ data }) => setMessages(data))
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [open, sessionId, historyLoaded]);

  if (!user) return null;

  const persistSession = (sid) => {
    setSessionId(sid);
    try {
      sessionStorage.setItem(STORAGE_KEY, sid);
    } catch {
      /* ignore */
    }
  };

  const send = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const { data } = await api.post("/chat", {
        message: text,
        session_id: sessionId || undefined,
      });
      if (!sessionId) persistSession(data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "No pude responder en este momento. Inténtalo de nuevo en un momento.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    if (sessionId) {
      try {
        await api.delete("/chat/history", { params: { session_id: sessionId } });
      } catch {
        /* ignore */
      }
    }
    setMessages([]);
    setSessionId("");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setHistoryLoaded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="chat-toggle"
          aria-label="Abrir asistente"
          className="fixed bottom-20 right-6 z-40 h-14 w-14 rounded-full bg-[var(--hc-platinum)] text-[var(--hc-bg)] shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:bg-white transition-colors flex items-center justify-center border border-[var(--hc-gold)]/30"
        >
          <MessageCircle className="h-6 w-6" strokeWidth={1.6} />
        </button>
      )}

      {open && (
        <div
          data-testid="chat-panel"
          className="fixed bottom-20 right-6 z-40 flex flex-col bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-[0_20px_50px_rgba(0,0,0,0.55)] w-[min(92vw,400px)] h-[min(75vh,620px)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hc-border)] bg-[var(--hc-bg)]">
            <div className="leading-tight">
              <div className="hc-overline text-[var(--hc-gold)]">Asistente</div>
              <div className="text-xs text-[var(--hc-text-secondary)] tracking-tight mt-0.5">
                Hampton Crest Academy
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                title="Nueva conversación"
                data-testid="chat-reset"
                className="h-8 w-8 flex items-center justify-center text-[var(--hc-text-muted)] hover:text-[var(--hc-gold)] transition-colors"
                aria-label="Reiniciar"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Cerrar"
                data-testid="chat-close"
                className="h-8 w-8 flex items-center justify-center text-[var(--hc-text-muted)] hover:text-[var(--hc-text)] transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            data-testid="chat-messages"
          >
            {messages.length === 0 && !sending && (
              <div className="text-xs text-[var(--hc-text-muted)] tracking-tight leading-relaxed">
                <div className="hc-overline mb-2 text-[var(--hc-gold)]/80">
                  En qué puedo ayudarte
                </div>
                <ul className="space-y-1.5 list-disc list-inside marker:text-[var(--hc-gold)]/60">
                  <li>Navegar la academia o tu cuenta</li>
                  <li>Conceptos de inversión y disciplina</li>
                  <li>Recomendaciones de lectura</li>
                  <li>Dudas sobre tu membresía</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[var(--hc-surface-elevated)] border border-[var(--hc-border)] px-3 py-2">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={send}
            className="border-t border-[var(--hc-border)] p-3 flex items-center gap-2 bg-[var(--hc-bg)]"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              disabled={sending}
              data-testid="chat-input"
              className="flex-1 bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] placeholder:text-[var(--hc-text-muted)] px-3 py-2 focus:outline-none focus:border-[var(--hc-gold)] transition-colors"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              data-testid="chat-send"
              aria-label="Enviar"
              className="h-9 w-9 flex items-center justify-center bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
