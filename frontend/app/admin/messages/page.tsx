"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Flag,
  FlagOff,
  Download,
  Trash2,
  MessageSquare,
  Clock,
  User,
  ArrowRight,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { mockMessages, type AdminMessage } from "@/lib/admin-mock-data";

interface MockThreadMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

function generateMockThread(conversation: AdminMessage): MockThreadMessage[] {
  const mockTexts = [
    "Hi! I came across your profile and I found it really interesting. Would love to connect with you.",
    "Thank you so much for reaching out! I went through your profile too. Tell me more about yourself.",
    "I am currently working in IT in Bangalore. I love traveling and reading. What about your hobbies?",
    "That sounds wonderful! I enjoy cooking and painting. I am based in Mumbai. Do you visit Mumbai often?",
    "Yes, I travel to Mumbai quite frequently for work. It would be nice to meet sometime if we feel the connection is right.",
  ];

  return mockTexts.map((text, i) => {
    const isFromUser = i % 2 === 0;
    return {
      id: `${conversation.id}-msg-${i + 1}`,
      senderId: isFromUser
        ? conversation.fromUser.id
        : conversation.toUser.id,
      senderName: isFromUser
        ? conversation.fromUser.name
        : conversation.toUser.name,
      text,
      timestamp: new Date(
        new Date(conversation.lastAt).getTime() - (4 - i) * 3600000
      ).toISOString(),
    };
  });
}

export default function MessagesPage() {
  const { toast } = useToast();
  const [conversations, setConversations] =
    useState<AdminMessage[]>(mockMessages);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    messageId: string;
    conversationId: string;
  }>({ open: false, messageId: "", conversationId: "" });

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.fromUser.name.toLowerCase().includes(q) ||
        c.toUser.name.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const threadMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return generateMockThread(selectedConversation);
  }, [selectedConversation]);

  const handleToggleFlag = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, flagged: !c.flagged } : c))
    );
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      toast(
        "success",
        conv.flagged
          ? "Conversation unflagged"
          : "Conversation flagged for review"
      );
    }
  };

  const handleDeleteMessage = () => {
    // In a real app this would call an API. Here we just show a toast.
    setDeleteModal({ open: false, messageId: "", conversationId: "" });
    toast("success", "Message deleted successfully");
  };

  const handleExport = () => {
    toast("info", "Conversation exported (mock)");
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Messages"
        subtitle="Monitor user conversations"
      />

      <div className="p-6">
        <div className="glass-card overflow-hidden flex flex-col lg:flex-row" style={{ minHeight: "calc(100vh - 160px)" }}>
          {/* Left Panel: Conversation List */}
          <div className="w-full lg:w-2/5 border-r border-gold/10 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-gold/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by user name..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-10 h-10 text-muted/30 mx-auto mb-2" />
                  <p className="font-body text-sm text-muted">
                    No conversations found
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full text-left px-4 py-3 border-b transition-colors ${
                      selectedId === conv.id
                        ? "bg-rose/5 border-l-2 border-l-rose"
                        : "hover:bg-blush/50"
                    } ${
                      conv.flagged
                        ? "border-l-2 border-l-amber-400"
                        : "border-gold/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-body text-sm font-medium text-deep truncate">
                            {conv.fromUser.name}
                          </p>
                          <ArrowRight className="w-3 h-3 text-muted flex-shrink-0" />
                          <p className="font-body text-sm font-medium text-deep truncate">
                            {conv.toUser.name}
                          </p>
                        </div>
                        <p className="font-body text-xs text-muted mt-1 truncate">
                          {conv.lastMessage}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="font-body text-[10px] text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(conv.lastAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-rose/10 text-rose font-body text-[10px] font-semibold">
                          {conv.messageCount}
                        </span>
                      </div>
                    </div>
                    {conv.flagged && (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-body text-[10px] font-semibold">
                        <Flag className="w-2.5 h-2.5" />
                        Flagged
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Message Thread */}
          <div className="w-full lg:w-3/5 flex flex-col">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-muted/20 mx-auto mb-3" />
                  <p className="font-body text-sm text-muted">
                    Select a conversation to view
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div className="p-4 border-b border-gold/10 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blush flex items-center justify-center">
                      <User className="w-4 h-4 text-rose/50" />
                    </div>
                    <span className="font-body text-sm font-medium text-deep">
                      {selectedConversation.fromUser.name}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted" />
                    <div className="w-8 h-8 rounded-full bg-blush flex items-center justify-center">
                      <User className="w-4 h-4 text-rose/50" />
                    </div>
                    <span className="font-body text-sm font-medium text-deep">
                      {selectedConversation.toUser.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose/10 text-rose font-body text-xs font-semibold ml-2">
                      {selectedConversation.messageCount} messages
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleToggleFlag(selectedConversation.id)
                      }
                      className={`p-2 rounded-lg transition-colors ${
                        selectedConversation.flagged
                          ? "bg-amber-50 text-amber-500 hover:bg-amber-100"
                          : "text-muted hover:text-deep hover:bg-blush"
                      }`}
                      title={
                        selectedConversation.flagged
                          ? "Unflag conversation"
                          : "Flag conversation"
                      }
                    >
                      {selectedConversation.flagged ? (
                        <FlagOff className="w-4 h-4" />
                      ) : (
                        <Flag className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleExport}
                      className="p-2 rounded-lg text-muted hover:text-deep hover:bg-blush transition-colors"
                      title="Export conversation"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Thread Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {threadMessages.map((msg) => {
                    const isFrom =
                      msg.senderId === selectedConversation.fromUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${
                          isFrom ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl p-3 ${
                            isFrom
                              ? "bg-blush/80 rounded-tl-sm"
                              : "bg-rose/10 rounded-tr-sm"
                          }`}
                        >
                          <p className="font-body text-xs font-semibold text-deep/70 mb-1">
                            {msg.senderName}
                          </p>
                          <p className="font-body text-sm text-deep">
                            {msg.text}
                          </p>
                          <div className="flex items-center justify-between gap-3 mt-2">
                            <span className="font-body text-[10px] text-muted">
                              {new Date(msg.timestamp).toLocaleTimeString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            <button
                              onClick={() =>
                                setDeleteModal({
                                  open: true,
                                  messageId: msg.id,
                                  conversationId: selectedConversation.id,
                                })
                              }
                              className="p-1 rounded text-muted/40 hover:text-red-500 transition-colors"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Message Confirm Modal */}
      <ConfirmModal
        open={deleteModal.open}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteMessage}
        onCancel={() =>
          setDeleteModal({ open: false, messageId: "", conversationId: "" })
        }
      />
    </div>
  );
}
