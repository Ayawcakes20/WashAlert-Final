import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, CheckCircle, X, Send, User, Headset, Bot, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { supportApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Ticket = {
  ticketNumber: string;
  sessionId: string;
  issue: string;
  status: string;
  branch: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: number;
  senderType: "USER" | "AI" | "HUMAN";
  message: string;
  category: string;
  escalationTicket: string | null;
  senderName: string | null;
  createdAt: string;
};

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const loadTickets = async () => {
    try {
      const data = await supportApi.allTickets();
      setTickets(data as unknown as Ticket[]);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error loading tickets", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadChatHistory = async (sessionId: string, ticketNumber: string) => {
    setChatLoading(true);
    try {
      const history = await supportApi.history(sessionId);
      // Filter messages that belong to this specific ticket
      const allMessages = history.messages || [];
      const ticketMessages = allMessages.filter(
        (msg) => msg.escalationTicket === ticketNumber
      );
      setChatMessages(ticketMessages);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error loading chat", description: err.message });
    } finally {
      setChatLoading(false);
    }
  };

  // Poll chat history for selected ticket
  useEffect(() => {
    if (!selectedTicket?.sessionId) return;
    loadChatHistory(selectedTicket.sessionId, selectedTicket.ticketNumber);
    const interval = setInterval(() => {
      loadChatHistory(selectedTicket.sessionId, selectedTicket.ticketNumber);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedTicket?.ticketNumber]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSelectTicket = (t: Ticket) => {
    setSelectedTicket(t);
    setChatMessages([]);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket || sending) return;
    setSending(true);
    try {
      await supportApi.replyToTicket(selectedTicket.ticketNumber, replyText);
      setReplyText("");
      // Immediately reload chat to show the new message
      if (selectedTicket.sessionId) {
        await loadChatHistory(selectedTicket.sessionId, selectedTicket.ticketNumber);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error sending reply", description: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async (ticketNumber: string) => {
    try {
      await supportApi.resolveTicket(ticketNumber);
      toast({ title: "Ticket resolved", description: "The ticket has been marked as resolved." });
      setSelectedTicket(null);
      setChatMessages([]);
      loadTickets();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const getSenderIcon = (type: string) => {
    switch (type) {
      case "USER": return <User className="w-4 h-4" />;
      case "HUMAN": return <Headset className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getSenderLabel = (msg: ChatMessage) => {
    switch (msg.senderType) {
      case "USER": return msg.senderName ? `Customer - ${msg.senderName}` : "Customer";
      case "HUMAN": return msg.senderName ? msg.senderName : "Staff";
      default: return "IkotAsk AI";
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (searchQuery && !t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">IkotAsk Support</h1>
      <p className="text-sm text-muted-foreground">View and reply to customer support tickets in real-time.</p>

      {loading ? (
        <p className="text-muted-foreground">Loading tickets...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket List */}
          <div className="lg:col-span-1 flex flex-col h-[700px]">
            {/* Filters */}
            <div className="flex gap-2 mb-4 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border/50 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="appearance-none pl-9 pr-8 py-2 bg-card border border-border/50 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="ALL">All</option>
                  <option value="OPEN">Open</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {paginatedTickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No support tickets found.</p>
                </div>
              ) : (
                paginatedTickets.map((t) => (
                <div
                  key={t.ticketNumber}
                  onClick={() => handleSelectTicket(t)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    selectedTicket?.ticketNumber === t.ticketNumber
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs font-bold text-primary">{t.ticketNumber}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        t.status === "OPEN"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{t.issue}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </p>
                    {t.branch && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium truncate max-w-[140px]">
                        {t.branch}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            </div>

            {/* Pagination UI */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t shrink-0">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded-lg hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent flex items-center gap-1 text-sm font-medium"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded-lg hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent flex items-center gap-1 text-sm font-medium"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Chat View */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedTicket ? (
                <motion.div
                  key={selectedTicket.ticketNumber}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-card border border-border/50 rounded-2xl flex flex-col h-[700px]"
                >
                  {/* Header */}
                  <div className="flex justify-between items-center p-5 border-b border-border/50">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{selectedTicket.ticketNumber}</h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedTicket.status === "OPEN" ? "🟢 Live Chat" : "✅ Resolved"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedTicket.status === "OPEN" && (
                        <button
                          onClick={() => handleResolve(selectedTicket.ticketNumber)}
                          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-xs font-medium rounded-lg hover:bg-emerald-500/20 flex items-center gap-2 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" /> Resolve
                        </button>
                      )}
                      <button onClick={() => { setSelectedTicket(null); setChatMessages([]); }} className="p-1.5 text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {chatLoading && chatMessages.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">Loading conversation...</p>
                    ) : chatMessages.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">No messages yet.</p>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.senderType === "HUMAN" ? "flex-row-reverse" : ""}`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              msg.senderType === "HUMAN"
                                ? "bg-primary/10 text-primary"
                                : msg.senderType === "AI"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {getSenderIcon(msg.senderType)}
                          </div>
                          <div className={`max-w-[75%] flex flex-col ${msg.senderType === "HUMAN" ? "items-end" : "items-start"}`}>
                            <p className="text-[10px] text-muted-foreground mb-1">
                              {getSenderLabel(msg)} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <div
                              style={{ wordBreak: 'break-word' }}
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed text-left w-fit ${
                                msg.senderType === "HUMAN"
                                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                                  : msg.senderType === "AI"
                                  ? "bg-amber-500/10 text-foreground border border-amber-500/20 rounded-tl-sm"
                                  : "bg-muted/50 text-foreground rounded-tl-sm"
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Reply Input */}
                  {selectedTicket.status === "OPEN" && (
                    <div className="p-4 border-t border-border/50 flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                        placeholder="Type your reply to the customer..."
                        className="flex-1 bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        disabled={sending}
                      />
                      <button
                        onClick={handleReply}
                        disabled={!replyText.trim() || sending}
                        className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="h-[700px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/30 rounded-2xl">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">Select a ticket to view the conversation</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
