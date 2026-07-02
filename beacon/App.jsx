import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are Beacon, a warm, empathetic benefits eligibility assistant for a nonprofit. Your job is to help people discover which public assistance programs they may qualify for.

RULES:
- Ask exactly ONE question at a time. Never ask two questions in one message.
- Be conversational, friendly, and plain-spoken. No jargon.
- Keep each message to 2-3 sentences max.
- Be encouraging, never judgmental.
- Accept vague or approximate answers gracefully.

SCREENING FLOW (roughly in this order):
1. Greet warmly. Ask what U.S. state they live in.
2. Ask about household size (how many people live with them).
3. Ask about approximate monthly household income (or if they have any income).
4. Ask about employment status (working, unemployed, student, retired, disabled, etc).
5. Ask if there are children under 18, elderly (65+), pregnant individuals, or people with disabilities in the household.
6. Ask about current health insurance status.
7. Ask about housing situation (renting, owning, or experiencing housing instability).

PROGRAMS TO ASSESS:
- SNAP (food stamps): income ≤130% FPL
- Medicaid: low income health coverage
- CHIP: children in families 138–400% FPL
- WIC: pregnant/postpartum women, infants, children under 5, income ≤185% FPL
- LIHEAP: utility bill help, income ≤150% FPL
- Section 8/HCV: housing assistance for very low income
- TANF: families with children needing temporary cash assistance
- SSI: elderly 65+ or disabled with limited income
- Head Start: children ages 3–5 from low-income families
- Free/Reduced Price School Lunch: school-age children

WHEN DONE (after ~7 questions):
When you have gathered enough information for a reasonable assessment, provide a warm closing message, then append a results block in this EXACT format on its own line at the very end:

<RESULTS>{"eligible":["Program A","Program B"],"summary":"One warm encouraging sentence about what you found.","nextSteps":["Visit benefits.gov to apply online","Contact your local Department of Social Services","Call 211 for local assistance resources"],"complete":true}</RESULTS>

Do NOT include <RESULTS> during the conversation — only at the very end when you're ready to show the final assessment.`;

export default function Beacon() {
  const [phase, setPhase] = useState("landing");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [error, setError] = useState(null);
  const [savedToSheet, setSavedToSheet] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const TOTAL_QUESTIONS = 7;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (phase === "chat" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, loading]);

  const callClaude = async (messageHistory) => {
    // Artifact proxy does not support top-level system param —
    // inject instructions into the first user message instead.
    const messages = messageHistory.map((msg, i) => {
      if (i === 0 && msg.role === "user") {
        return {
          role: "user",
          content: `<instructions>
${SYSTEM_PROMPT}
</instructions>

${msg.content}`,
        };
      }
      return msg;
    });

    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages,
        }),
      });
    } catch (e) {
      throw new Error(`Network error: ${e.message}`);
    }

    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Non-JSON response (${res.status}): ${rawText.slice(0, 150)}`);
    }

    if (!res.ok) {
      throw new Error(data?.error?.message || `HTTP ${res.status}`);
    }

    if (!Array.isArray(data?.content)) {
      throw new Error(`Unexpected shape: ${JSON.stringify(data).slice(0, 150)}`);
    }

    return data.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  };

  const startChat = async () => {
    setPhase("chat");
    setLoading(true);
    setError(null);
    try {
      const initialMsg = { role: "user", content: "Hi, I'd like to check what benefits I might qualify for." };
      const reply = await callClaude([initialMsg]);
      setMessages([initialMsg, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(`Failed to start: ${e.message}`);
      setPhase("landing");
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setError(null);
    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);
    setQuestionCount((c) => c + 1);

    try {
      const rawReply = await callClaude(newMessages);
      const match = rawReply.match(/<RESULTS>([\s\S]*?)<\/RESULTS>/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1].trim());
          if (parsed.complete) {
            setResults(parsed);
            const cleanText = rawReply.replace(/<RESULTS>[\s\S]*?<\/RESULTS>/g, "").trim();
            if (cleanText) {
              setMessages([...newMessages, { role: "assistant", content: cleanText }]);
            }
            setTimeout(() => setPhase("results"), 800);
            setLoading(false);
            return;
          }
        } catch {}
      }
      setMessages([...newMessages, { role: "assistant", content: rawReply }]);
    } catch (e) {
      setError(`Error: ${e.message} — please try again.`);
    }
    setLoading(false);
  };

  const downloadResults = () => {
    if (!results) return;
    const content = `BENEFITS ELIGIBILITY RESULTS
Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${results.summary}

PROGRAMS YOU MAY QUALIFY FOR:
${results.eligible.map((p) => `  • ${p}`).join("\n")}

RECOMMENDED NEXT STEPS:
${results.nextSteps?.map((s, i) => `  ${i + 1}. ${s}`).join("\n") || "  1. Visit benefits.gov to explore programs\n  2. Call 211 for local resources"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Beacon | Powered by Claude AI
DISCLAIMER: This is not an official eligibility determination.
Contact your local benefits office or visit benefits.gov to apply.`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-benefits-results.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const simulateSaveToSheet = () => {
    setSavedToSheet(true);
    setTimeout(() => setSavedToSheet(false), 3000);
  };

  const restart = () => {
    setPhase("landing");
    setMessages([]);
    setResults(null);
    setQuestionCount(0);
    setError(null);
    setSavedToSheet(false);
    setInput("");
  };

  const progress = Math.min((questionCount / TOTAL_QUESTIONS) * 100, 100);

  const PROGRAMS = ["SNAP", "Medicaid", "CHIP", "WIC", "LIHEAP", "Section 8", "TANF", "Head Start"];

  // ─── LANDING PAGE ───────────────────────────────────────────────────────────
  if (phase === "landing") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #EEF2FF 0%, #F0FDF4 100%)", fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
          {/* Logo */}
          <div style={{ width: "72px", height: "72px", background: "linear-gradient(135deg, #1D4ED8, #0EA5E9)", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: "36px", boxShadow: "0 8px 24px rgba(29,78,216,0.25)" }}>
            🛡️
          </div>

          <h1 style={{ fontSize: "34px", fontWeight: "800", color: "#0F172A", margin: "0 0 14px", letterSpacing: "-0.8px", lineHeight: "1.15" }}>
            Find Your Benefits
          </h1>
          <p style={{ color: "#475569", fontSize: "16px", lineHeight: "1.7", margin: "0 0 36px" }}>
            Answer 7 simple questions and discover which public assistance programs you may qualify for — free, private, and under 5 minutes.
          </p>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>
              {error}
            </div>
          )}

          <button
            onClick={startChat}
            style={{ background: "linear-gradient(135deg, #1D4ED8, #0EA5E9)", color: "white", border: "none", borderRadius: "14px", padding: "17px 32px", fontSize: "16px", fontWeight: "700", cursor: "pointer", width: "100%", letterSpacing: "0.2px", boxShadow: "0 4px 16px rgba(29,78,216,0.35)", transition: "opacity 0.15s" }}
            onMouseEnter={(e) => (e.target.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.target.style.opacity = "1")}
          >
            Check My Eligibility →
          </button>

          <p style={{ color: "#94A3B8", fontSize: "12.5px", marginTop: "14px" }}>
            Private &amp; confidential · Not an official determination
          </p>

          {/* Program pills */}
          <div style={{ marginTop: "40px", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            {PROGRAMS.map((p) => (
              <span key={p} style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "20px", padding: "5px 13px", fontSize: "13px", color: "#334155", fontWeight: "500" }}>
                {p}
              </span>
            ))}
          </div>

          {/* Built with tag */}
          <div style={{ marginTop: "48px", color: "#CBD5E1", fontSize: "12px" }}>
            Powered by Claude AI · Built for Claude Corps Fellow Application
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS PAGE ────────────────────────────────────────────────────────────
  if (phase === "results" && results) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #EEF2FF 0%, #F0FDF4 100%)", fontFamily: "system-ui, -apple-system, sans-serif", padding: "32px 24px" }}>
        <div style={{ maxWidth: "540px", margin: "0 auto" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div style={{ fontSize: "52px", marginBottom: "14px" }}>🎉</div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0F172A", margin: "0 0 10px", letterSpacing: "-0.5px" }}>
              Your Results Are Ready
            </h1>
            <p style={{ color: "#64748B", fontSize: "15px", lineHeight: "1.6", maxWidth: "400px", margin: "0 auto" }}>
              {results.summary}
            </p>
          </div>

          {/* Programs */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
              Programs You May Qualify For ({results.eligible.length})
            </div>
            {results.eligible.map((program, i) => (
              <div
                key={i}
                style={{ background: "white", borderRadius: "12px", padding: "16px 18px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0", animation: "slideIn 0.3s ease forwards", animationDelay: `${i * 0.1}s`, opacity: 0 }}
              >
                <div style={{ width: "34px", height: "34px", background: "#F0FDF4", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#16A34A", fontSize: "18px", flexShrink: 0 }}>
                  ✓
                </div>
                <span style={{ fontWeight: "700", color: "#0F172A", fontSize: "15px" }}>{program}</span>
              </div>
            ))}
          </div>

          {/* Next Steps */}
          {results.nextSteps && (
            <div style={{ background: "white", borderRadius: "14px", padding: "20px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "14px" }}>
                Recommended Next Steps
              </div>
              {results.nextSteps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "10px", alignItems: "flex-start" }}>
                  <div style={{ width: "22px", height: "22px", background: "#EFF6FF", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#1D4ED8", fontWeight: "700", fontSize: "12px", flexShrink: 0, marginTop: "1px" }}>
                    {i + 1}
                  </div>
                  <span style={{ color: "#334155", fontSize: "14px", lineHeight: "1.5" }}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button
              onClick={downloadResults}
              style={{ flex: 1, background: "linear-gradient(135deg, #1D4ED8, #0EA5E9)", color: "white", border: "none", borderRadius: "12px", padding: "14px", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
            >
              ⬇ Download Results
            </button>
            <button
              onClick={simulateSaveToSheet}
              style={{ flex: 1, background: savedToSheet ? "#16A34A" : "white", color: savedToSheet ? "white" : "#334155", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px", fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.3s" }}
            >
              {savedToSheet ? "✓ Saved!" : "📊 Save to Sheet"}
            </button>
          </div>

          <button
            onClick={restart}
            style={{ width: "100%", background: "transparent", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px", fontSize: "14px", cursor: "pointer" }}
          >
            Start a New Screening
          </button>

          <p style={{ color: "#94A3B8", fontSize: "12px", textAlign: "center", marginTop: "20px", lineHeight: "1.6" }}>
            This is not an official eligibility determination. Contact your local benefits office or visit{" "}
            <span style={{ color: "#1D4ED8" }}>benefits.gov</span> to apply.
          </p>
        </div>

        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ─── CHAT PAGE ───────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", background: "#F8FAFC", fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", padding: "0 20px", display: "flex", alignItems: "center", gap: "12px", height: "62px", flexShrink: 0 }}>
        <div style={{ width: "38px", height: "38px", background: "linear-gradient(135deg, #1D4ED8, #0EA5E9)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
          🛡️
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "700", color: "#0F172A", fontSize: "15px" }}>Beacon</div>
          <div style={{ fontSize: "12px", color: "#10B981", fontWeight: "500" }}>● Active Screening</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", marginBottom: "4px" }}>
            {Math.round(progress)}% complete
          </div>
          <div style={{ width: "80px", height: "4px", background: "#E2E8F0", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #1D4ED8, #0EA5E9)", borderRadius: "2px", transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 8px" }}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "12px", gap: "8px", alignItems: "flex-end" }}>
              {!isUser && (
                <div style={{ width: "30px", height: "30px", background: "linear-gradient(135deg, #1D4ED8, #0EA5E9)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>
                  🛡️
                </div>
              )}
              <div style={{
                maxWidth: "78%",
                background: isUser ? "linear-gradient(135deg, #1D4ED8, #0EA5E9)" : "white",
                color: isUser ? "white" : "#0F172A",
                padding: "12px 16px",
                borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                fontSize: "15px",
                lineHeight: "1.55",
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
              }}>
                {m.content}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "12px", gap: "8px", alignItems: "flex-end" }}>
            <div style={{ width: "30px", height: "30px", background: "linear-gradient(135deg, #1D4ED8, #0EA5E9)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
              🛡️
            </div>
            <div style={{ background: "white", padding: "14px 18px", borderRadius: "18px 18px 18px 4px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: "7px", height: "7px", background: "#CBD5E1", borderRadius: "50%", animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", fontSize: "14px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ background: "white", borderTop: "1px solid #E2E8F0", padding: "14px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "10px", maxWidth: "640px", margin: "0 auto" }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Type your answer..."
            disabled={loading}
            style={{ flex: 1, border: "1.5px solid #E2E8F0", borderRadius: "12px", padding: "13px 16px", fontSize: "15px", outline: "none", fontFamily: "inherit", background: loading ? "#F8FAFC" : "white", color: "#0F172A", transition: "border-color 0.2s" }}
            onFocus={(e) => (e.target.style.borderColor = "#1D4ED8")}
            onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{ background: "linear-gradient(135deg, #1D4ED8, #0EA5E9)", color: "white", border: "none", borderRadius: "12px", padding: "13px 20px", fontSize: "20px", cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.45 : 1, transition: "opacity 0.2s", flexShrink: 0 }}
          >
            →
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "11.5px", color: "#94A3B8" }}>
          Press Enter to send · Your answers are not stored
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
