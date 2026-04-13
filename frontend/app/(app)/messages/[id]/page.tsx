"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Send, Lock, Phone, Video, MoreHorizontal, CheckCheck } from "lucide-react";

const threadProfiles: Record<string, { name: string; photo: string; grad: string; compatibility: number; city: string }> = {
  "1": { name: "Priya Sharma",   photo: "PS", grad: "linear-gradient(135deg,#E8426A,#E8A060)", compatibility: 92, city: "Mumbai" },
  "2": { name: "Anjali Patel",   photo: "AP", grad: "linear-gradient(135deg,#9A6B00,#C89020)",  compatibility: 87, city: "Ahmedabad" },
  "3": { name: "Kavya Nair",     photo: "KN", grad: "linear-gradient(135deg,#5C7A52,#8DB870)",  compatibility: 84, city: "Bangalore" },
  "4": { name: "Shruti Agarwal", photo: "SA", grad: "linear-gradient(135deg,#E8426A99,#9A6B0099)", compatibility: 79, city: "Delhi" },
};

const initialMessages: Record<string, { id: string; from: "me" | "them"; text: string; time: string }[]> = {
  "1": [
    { id: "1", from: "them", text: "Namaste! Thank you for sending an interest. I went through your profile and it's really impressive 😊", time: "10:30 AM" },
    { id: "2", from: "me",   text: "Namaste Priya! Thank you so much. I was genuinely impressed by your work at Google and your passion for Carnatic music.", time: "10:35 AM" },
    { id: "3", from: "them", text: "That's so kind! I saw you're into trekking too. Have you done any Himalayan treks?", time: "10:38 AM" },
    { id: "4", from: "me",   text: "Yes! Done Kedarkantha and Hampta Pass. Planning Roopkund next year. Do you trek?", time: "10:40 AM" },
    { id: "5", from: "them", text: "Oh wow, Kedarkantha is on my list! I've only done Triund so far. Would love to hear more about your work. What are you building at the startup?", time: "10:42 AM" },
  ],
  "2": [
    { id: "1", from: "them", text: "Hello! I saw your profile and thought we have a lot in common. My family is from Ahmedabad, what about yours?", time: "Yesterday 6:00 PM" },
    { id: "2", from: "me",   text: "Hi Anjali! Nice to connect. My family is from Rajasthan originally, settled in Mumbai.", time: "Yesterday 6:45 PM" },
  ],
  "3": [
    { id: "1", from: "them", text: "I saw you're also into trekking. Have you done Kedarkantha?", time: "Mon 3:20 PM" },
  ],
  "4": [
    { id: "1", from: "me",   text: "Hi Shruti! Lovely to connect. Delhi winters are harsh I imagine!", time: "Sun 11:10 AM" },
    { id: "2", from: "them", text: "Haha yes, Delhi winters are something else 😄", time: "Sun 11:30 AM" },
  ],
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const profile = threadProfiles[params.id] || threadProfiles["1"];
  const [messages, setMessages] = useState(initialMessages[params.id] || []);
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), from: "me", text: input.trim(), time: "Just now" },
    ]);
    setInput("");
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        maxWidth: "672px",
        background: "#fdfbf9",
        fontFamily: "var(--font-poppins, sans-serif)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "16px 24px",
          flexShrink: 0,
          background: "#ffffff",
          borderBottom: "1px solid rgba(220,30,60,0.12)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Back */}
        <Link
          href="/messages"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            color: "rgba(26,10,20,0.5)",
            background: "rgba(220,30,60,0.05)",
            border: "1px solid rgba(220,30,60,0.12)",
            textDecoration: "none",
            flexShrink: 0,
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background =
              "rgba(220,30,60,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background =
              "rgba(220,30,60,0.05)";
          }}
        >
          <ArrowLeft style={{ width: "18px", height: "18px" }} />
        </Link>

        {/* Avatar */}
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            background: profile.grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-playfair, serif)",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "#ffffff",
            flexShrink: 0,
            border: "2px solid rgba(220,30,60,0.25)",
            boxShadow: "0 2px 10px rgba(220,30,60,0.2)",
          }}
        >
          {profile.photo}
        </div>

        {/* Name & status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#1a0a14",
                margin: 0,
              }}
            >
              {profile.name}
            </h2>
            <Shield
              style={{ width: "14px", height: "14px", color: "#dc1e3c", flexShrink: 0 }}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "1px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#dc1e3c",
                boxShadow: "0 0 0 2px rgba(220,30,60,0.2)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-poppins, sans-serif)",
                fontSize: "0.75rem",
                color: "rgba(26,10,20,0.45)",
              }}
            >
              {profile.city} ·{" "}
              <span style={{ color: "#C89020", fontWeight: 600 }}>
                {profile.compatibility}% match
              </span>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {[
            { icon: <Phone style={{ width: "16px", height: "16px" }} />, label: "Call" },
            { icon: <Video style={{ width: "16px", height: "16px" }} />, label: "Video" },
          ].map((btn) => (
            <button
              key={btn.label}
              aria-label={btn.label}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "transparent",
                border: "1px solid rgba(220,30,60,0.12)",
                color: "rgba(26,10,20,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(220,30,60,0.07)";
                (e.currentTarget as HTMLButtonElement).style.color = "#dc1e3c";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(26,10,20,0.45)";
              }}
            >
              {btn.icon}
            </button>
          ))}
          <Link
            href={`/profile/${params.id}`}
            aria-label="View profile"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "transparent",
              border: "1px solid rgba(220,30,60,0.12)",
              color: "rgba(26,10,20,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "rgba(220,30,60,0.07)";
              (e.currentTarget as HTMLAnchorElement).style.color = "#dc1e3c";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "transparent";
              (e.currentTarget as HTMLAnchorElement).style.color =
                "rgba(26,10,20,0.45)";
            }}
          >
            <MoreHorizontal style={{ width: "16px", height: "16px" }} />
          </Link>
        </div>
      </div>

      {/* ── E2E encryption notice ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "8px 16px",
          background: "rgba(220,30,60,0.03)",
          borderBottom: "1px solid rgba(220,30,60,0.08)",
          flexShrink: 0,
        }}
      >
        <Lock style={{ width: "11px", height: "11px", color: "#dc1e3c" }} />
        <span
          style={{
            fontFamily: "var(--font-poppins, sans-serif)",
            fontSize: "0.6875rem",
            color: "rgba(220,30,60,0.65)",
          }}
        >
          Messages are end-to-end encrypted · Signal Protocol
        </span>
      </div>

      {/* ── Message list ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          background: "#fdfbf9",
        }}
      >
        {messages.map((msg, idx) => {
          const isMe = msg.from === "me";
          // Group consecutive same-sender messages
          const prevMsg = messages[idx - 1];
          const isSameSenderAsPrev = prevMsg?.from === msg.from;

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
                marginTop: isSameSenderAsPrev ? "4px" : "12px",
              }}
            >
              <div style={{ maxWidth: "75%" }}>
                {/* Bubble */}
                <div
                  style={
                    isMe
                      ? {
                          background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                          color: "#ffffff",
                          borderRadius: "18px",
                          borderBottomRightRadius: "5px",
                          padding: "10px 16px",
                          fontFamily: "var(--font-poppins, sans-serif)",
                          fontSize: "0.875rem",
                          lineHeight: 1.55,
                          boxShadow: "0 2px 12px rgba(220,30,60,0.25)",
                        }
                      : {
                          background: "#ffffff",
                          color: "#1a0a14",
                          borderRadius: "18px",
                          borderBottomLeftRadius: "5px",
                          padding: "10px 16px",
                          fontFamily: "var(--font-poppins, sans-serif)",
                          fontSize: "0.875rem",
                          lineHeight: 1.55,
                          border: "1px solid rgba(220,30,60,0.1)",
                          boxShadow: "0 1px 6px rgba(26,10,20,0.07)",
                        }
                  }
                >
                  {msg.text}
                </div>

                {/* Timestamp + read receipt */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginTop: "4px",
                    justifyContent: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-poppins, sans-serif)",
                      fontSize: "0.625rem",
                      color: "rgba(26,10,20,0.35)",
                    }}
                  >
                    {msg.time}
                  </span>
                  {isMe && (
                    <CheckCheck
                      style={{ width: "12px", height: "12px", color: "#dc1e3c" }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
          background: "#ffffff",
          borderTop: "1px solid rgba(220,30,60,0.12)",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          style={{
            flex: 1,
            height: "44px",
            padding: "0 16px",
            fontFamily: "var(--font-poppins, sans-serif)",
            fontSize: "0.875rem",
            color: "#1a0a14",
            background: "#fdfbf9",
            border: inputFocused
              ? "1px solid rgba(220,30,60,0.55)"
              : "1px solid rgba(220,30,60,0.18)",
            borderRadius: "9999px",
            outline: "none",
            boxShadow: inputFocused
              ? "0 0 0 3px rgba(220,30,60,0.08)"
              : "none",
            transition: "border-color 0.18s ease, box-shadow 0.18s ease",
          }}
        />

        <button
          onClick={send}
          aria-label="Send message"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "none",
            background: input.trim()
              ? "linear-gradient(135deg, #dc1e3c, #a0153c)"
              : "rgba(220,30,60,0.15)",
            color: input.trim() ? "#ffffff" : "rgba(220,30,60,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: input.trim() ? "pointer" : "default",
            flexShrink: 0,
            boxShadow: input.trim() ? "0 3px 12px rgba(220,30,60,0.35)" : "none",
            transition: "background 0.18s ease, box-shadow 0.18s ease",
          }}
        >
          <Send style={{ width: "18px", height: "18px" }} />
        </button>
      </div>
    </div>
  );
}
