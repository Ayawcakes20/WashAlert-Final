import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Send, Bot, User, Headphones, ArrowUpRight, Loader2,
  Search, CheckCircle2, AlertCircle, Clock, Filter, RefreshCw,
  Package, MapPin,
} from "lucide-react";
import { supportApi } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { getSessionUser } from "@/lib/session";

interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "human" | "system";
  text: string;
  time: string;
  orderData?: OrderData | null;
}

interface OrderData {
  trackingNumber: string;
  status: string;
  branch: string;
  customerName: string;
  serviceType: string;
}

interface Ticket {
  id: string;
  issue: string;
  time: string;
  status: string;
  rawStatus: string;
}

const quickReplies = [
  "Track my order",
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

const formatTime = (iso?: string) =>
  new Date(iso || Date.now()).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

const ticketStatusColor: Record<string, string> = {
  OPEN: "bg-destructive/10 text-destructive",
  IN_PROGRESS: "bg-amber-500/15 text-amber-600",
  RESOLVED: "bg-emerald-500/15 text-emerald-600",
  CLOSED: "bg-muted text-muted-foreground",
};

const ticketStatusLabel: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

// Parse order data from AI reply data field
function parseOrderData(data: unknown): OrderData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, any>;
  const order = d.order as Record<string, any> | undefined;
  if (!order) return null;
  return {
    trackingNumber: order.trackingNumber || order.tracking_number || "",
    status: order.status || "",
    branch: order.branch || "",
    customerName: order.customerName || order.customer_name || "",
    serviceType: order.serviceType || order.service_type || "",
  };
}

// Extract tracking number from text
const TRACKING_RE = /WA-\d+/i;
function extractTracking(text: string): string | undefined {
  return TRACKING_RE.exec(text)?.[0]?.toUpperCase();
}

export default function AIChatSupportPage() {
  const user = getSessionUser();
  const isStaff = user?.role === "ADMIN" || user?.role === "STAFF";

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "init-1", sender: "ai", text: "Hello! Welcome to WashAlert Support. I am your AI assistant. How can I help you today?", time: formatTime() },
  ]);
  const [input, setInput] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = getOrCreateSessionId();

  // Admin panel state
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("All");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const mapTickets = (raw: Array<{ ticketNumber: string; issue: string; status: string; createdAt: string; updatedAt: string }>): Ticket[] =>
    raw.map((t) => ({
      id: t.ticketNumber,
      issue: t.issue,
      time: formatTime(t.createdAt),
      status: ticketStatusLabel[t.rawStatus || t.status] || t.status,
      rawStatus: t.status,
    }));

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
            orderData: null,
          }))
        );
      }
      setTickets(mapTickets(history.tickets as any));
    } catch {
      // keep default intro
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadAllTickets = async () => {
    if (!isStaff) return;
    try {
      const data = await supportApi.allTickets();
      setAllTickets(mapTickets(data as any));
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    void loadHistory();
    void loadAllTickets();
  }, []); // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || sending) return;

    const nowLabel = formatTime();
    const tracking = extractTracking(msgText);

    const optimisticUser: ChatMessage = { id: `temp-user-${Date.now()}`, sender: "user", text: msgText, time: nowLabel };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setSending(true);

    try {
      const res = await supportApi.chat(msgText, sessionId, tracking);
      const orderData = res.category === "tracking" ? parseOrderData(res.data) : null;
      const aiMsg: ChatMessage = {
        id: `temp-ai-${Date.now()}`,
        sender: res.escalated ? "human" : "ai",
        text: res.reply,
        time: formatTime(),
        orderData,
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== `temp-user-${Date.now() - 1}`), optimisticUser, aiMsg]);

      if (res.escalated && res.escalationTicket) {
        toast("Ticket escalated", { description: `Your ticket ${res.escalationTicket} has been created.` });
        await loadHistory();
        await loadAllTickets();
      }
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

  const handleResolve = async (ticketId: string) => {
    setResolving(ticketId);
    try {
      await supportApi.resolveTicket(ticketId);
      toast.success(`Ticket ${ticketId} marked as resolved.`);
      // Update local state immediately
      const update = (arr: Ticket[]) =>
        arr.map((t) => t.id === ticketId ? { ...t, rawStatus: "RESOLVED", status: "Resolved" } : t);
      setTickets(update);
      setAllTickets(update);
      if (selectedTicket?.id === ticketId) setSelectedTicket((prev) => prev ? { ...prev, rawStatus: "RESOLVED", status: "Resolved" } : prev);
    } catch (err: any) {
      toast.error(err?.message || "Unable to resolve ticket.");
    } finally {
      setResolving(null);
    }
  };

  const filteredAllTickets = useMemo(() => {
    let list = allTickets;
    if (ticketFilter !== "All") list = list.filter((t) => t.rawStatus === ticketFilter);
    if (ticketSearch) list = list.filter((t) => t.id.toLowerCase().includes(ticketSearch.toLowerCase()) || t.issue.toLowerCase().includes(ticketSearch.toLowerCase()));
    return list;
  }, [allTickets, ticketFilter, ticketSearch]);

  // ── Admin / Staff 3-panel layout ──────────────────────────────────
  if (isStaff) {
    return (
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="space-y-6">
        <motion.div variants={item}>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Chat Support</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor and manage customer support tickets with AI assistance</p>
        </motion.div>

        <motion.div variants={item} className="flex gap-4 h-[calc(100vh-180px)]">
          {/* LEFT: Ticket list panel */}
          <div className="w-72 surface-card flex flex-col overflow-hidden flex-shrink-0">
            <div className="p-3 border-b border-border/30">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {["All", "OPEN", "IN_PROGRESS", "RESOLVED"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setTicketFilter(f)}
                    className={`flex-1 py-1 rounded text-xs font-medium transition-colors min-w-[3rem] ${ticketFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {f === "All" ? "All" : ticketStatusLabel[f]}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{filteredAllTickets.length} ticket(s)</span>
                <button onClick={() => void loadAllTickets()} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredAllTickets.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No tickets found.</div>
              )}
              {filteredAllTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`w-full text-left p-3 border-b border-border/20 hover:bg-muted/40 transition-colors ${selectedTicket?.id === t.id ? "bg-muted/60" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-primary">{t.id}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ticketStatusColor[t.rawStatus] || "bg-muted text-muted-foreground"}`}>{t.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.issue}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{t.time}</p>
                </button>
              ))}
            </div>
          </div>

          {/* CENTER: Ticket detail */}
          <div className="flex-1 surface-card flex flex-col overflow-hidden">
            {selectedTicket ? (
              <>
                <div className="p-4 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <Headphones className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedTicket.id}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ticketStatusColor[selectedTicket.rawStatus] || "bg-muted text-muted-foreground"}`}>
                        {selectedTicket.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedTicket.rawStatus !== "RESOLVED" && selectedTicket.rawStatus !== "CLOSED" && (
                      <button
                        onClick={() => void handleResolve(selectedTicket.id)}
                        disabled={resolving === selectedTicket.id}
                        className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-emerald-600 transition-colors disabled:opacity-60"
                      >
                        {resolving === selectedTicket.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                  <div className="glass-card rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Issue Description</p>
                    <p className="text-sm text-foreground leading-relaxed">{selectedTicket.issue}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Created: {selectedTicket.time}</div>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Bot className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <p>This ticket was escalated by the AI assistant because it requires human attention. Use the "Mark Resolved" button once the issue is addressed.</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Headphones className="h-12 w-12 opacity-20" />
                <p className="text-sm">Select a ticket to view details</p>
              </div>
            )}
          </div>

          {/* RIGHT: Summary panel */}
          <div className="w-64 surface-card flex-shrink-0 overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ticket Summary</p>
              {[
                { label: "Open", status: "OPEN", color: "text-destructive", icon: AlertCircle },
                { label: "In Progress", status: "IN_PROGRESS", color: "text-amber-600", icon: Clock },
                { label: "Resolved", status: "RESOLVED", color: "text-emerald-600", icon: CheckCircle2 },
              ].map((s) => (
                <div key={s.status} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-2">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-sm text-foreground">{s.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${s.color}`}>
                    {allTickets.filter((t) => t.rawStatus === s.status).length}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Session Tickets</p>
              {tickets.length === 0 && <p className="text-xs text-muted-foreground">No tickets in this session.</p>}
              {tickets.map((t) => (
                <div key={t.id} className="rounded-xl border border-border/30 p-3 mb-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-primary">{t.id}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ticketStatusColor[t.rawStatus] || "bg-muted text-muted-foreground"}`}>{t.status}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{t.issue}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Customer / Default single-chat view ───────────────────────────
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Chat Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Automated support with persisted chat history and escalation tickets</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat panel */}
        <motion.div variants={item} className="lg:col-span-2 surface-card flex flex-col h-[600px]">
          {/* Chat header */}
          <div className="p-4 border-b border-border/30 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">WashAlert Support Assistant</p>
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingHistory && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation...
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] ${msg.sender === "user" ? "order-2" : ""}`}>
                  <div className={`flex items-start gap-2 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${
                        msg.sender === "user"
                          ? "gradient-navy text-primary-foreground"
                          : msg.sender === "ai"
                          ? "bg-secondary/30 text-secondary-foreground"
                          : msg.sender === "human"
                          ? "bg-accent/20 text-accent-foreground"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {msg.sender === "user" ? <User className="h-3.5 w-3.5" /> : msg.sender === "ai" ? <Bot className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "gradient-navy text-primary-foreground"
                          : msg.sender === "human"
                          ? "bg-accent/12 text-foreground border border-accent/35"
                          : msg.sender === "ai"
                          ? "bg-secondary/18 text-foreground border border-secondary/40"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>

                      {/* Order tracking card */}
                      {msg.orderData && (
                        <div className="mt-3 p-3 rounded-xl bg-background/60 border border-border/30 text-foreground text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary">{msg.orderData.trackingNumber}</span>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{msg.orderData.status}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Package className="h-3 w-3" /> {msg.orderData.serviceType}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {msg.orderData.branch}
                          </div>
                          <div className="text-muted-foreground">Customer: {msg.orderData.customerName}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-1 ${msg.sender === "user" ? "text-right mr-9" : "ml-9"}`}>
                    {msg.sender === "human" ? "Staff � " : msg.sender === "ai" ? "AI � " : ""}{msg.time}
                  </p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 bg-muted/50 rounded-2xl px-4 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies */}
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

          {/* Input */}
          <div className="p-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSend()}
                placeholder="Type your message... (include WA-XXXXX to track an order)"
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

        {/* Tickets sidebar */}
        <motion.div variants={item} className="surface-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Headphones className="h-5 w-5 text-amber-500" /> Escalated Tickets
          </h2>
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/30 p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-primary">{t.id}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${ticketStatusColor[t.rawStatus] || "bg-muted text-muted-foreground"}`}>{t.status}</span>
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
            {!tickets.length && <p className="text-sm text-muted-foreground">No escalated tickets yet.</p>}
          </div>

          <div className="mt-6 p-4 bg-primary/5 border border-primary/15 rounded-xl">
            <div className="flex items-start gap-2">
              <Bot className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">The AI handles routine questions automatically. If your request needs human attention, a ticket will be created and routed to our staff.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

