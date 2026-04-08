import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User, Headphones, ArrowUpRight, Loader2 } from "lucide-react";
import { supportApi } from "@/lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "human" | "system";
  text: string;
  time: string;
}

const quickReplies = [
  "Track my order WA-10021",
  "What are your branch hours?",
  "How do payments work?",
  "I have a complaint",
  "Talk to staff",
];

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const SESSION_KEY = "washalert_support_session_id";

const getOrCreateSessionId = () => {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, next);
  return next;
};

const formatTime = (iso?: string) => {
  if (!iso) return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

export default function AIChatSupportPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "ai",
      text: "Hello! Welcome to WashAlert Support. I am your AI assistant. How can I help you today?",
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [tickets, setTickets] = useState<Array<{ id: string; issue: string; time: string; status: string }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = getOrCreateSessionId();

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await supportApi.history(sessionId);
      if (history.messages.length) {
        setMessages(
          history.messages.map((m) => ({
            id: String(m.id),
            sender: m.senderType === "USER" ? "user" : m.senderType === "HUMAN" ? "human" : "ai",
            text: m.message,
            time: formatTime(m.createdAt),
          })),
        );
      }
      setTickets(
        history.tickets.map((t) => ({
          id: t.ticketNumber,
          issue: t.issue,
          time: formatTime(t.createdAt),
          status: t.status,
        })),
      );
    } catch {
      // keep default local intro message
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || sending) return;

    const nowLabel = formatTime();
    const optimisticUser: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      sender: "user",
      text: msgText,
      time: nowLabel,
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setSending(true);

    try {
      await supportApi.chat(msgText, sessionId);
      await loadHistory();
    } catch (err: any) {
      const fallback: ChatMessage = {
        id: `temp-system-${Date.now()}`,
        sender: "system",
        text: err?.message || "Support service is currently unavailable.",
        time: nowLabel,
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Chat Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Automated support with persisted chat history and escalation tickets</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} className="lg:col-span-2 glass-card rounded-2xl flex flex-col h-[600px]">
          <div className="p-4 border-b border-border/30 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">WashAlert Support Assistant</p>
              <p className="text-xs text-mint flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" /> Online
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingHistory ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation...
              </div>
            ) : null}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] ${msg.sender === "user" ? "order-2" : ""}`}>
                  <div className={`flex items-start gap-2 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${
                        msg.sender === "user"
                          ? "gradient-navy text-primary-foreground"
                          : msg.sender === "ai"
                          ? "bg-primary/10 text-primary"
                          : msg.sender === "human"
                          ? "bg-accent/15 text-accent"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {msg.sender === "user" ? (
                        <User className="h-3.5 w-3.5" />
                      ) : msg.sender === "ai" ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <Headphones className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "gradient-navy text-primary-foreground"
                          : msg.sender === "human"
                          ? "bg-accent/10 text-foreground border border-accent/20"
                          : msg.sender === "ai"
                          ? "bg-muted/50 text-foreground"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-1 ${msg.sender === "user" ? "text-right mr-9" : "ml-9"}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {quickReplies.map((qr) => (
              <button
                key={qr}
                onClick={() => void handleSend(qr)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {qr}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSend()}
                placeholder="Type your message..."
                className="flex-1 h-11 px-4 rounded-xl border border-border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
              />
              <button
                onClick={() => void handleSend()}
                disabled={sending}
                className="h-11 w-11 rounded-xl gradient-navy text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-70"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Headphones className="h-5 w-5 text-accent" /> Escalated Tickets
          </h2>
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/30 p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-primary">{t.id}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive">{t.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{t.issue}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{t.time}</span>
                  <button className="text-[10px] font-semibold text-primary flex items-center gap-1">
                    View <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {!tickets.length ? <p className="text-sm text-muted-foreground">No escalated tickets yet.</p> : null}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
