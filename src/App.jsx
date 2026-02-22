import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
const HRT_BG = `${BASE}hrt_letterhead.png`;
const TRT_BG = `${BASE}trt_letterhead.png`;
const LOGO   = `${BASE}logo.png`;

const DRAFT_DEBOUNCE_MS = 600;
const LONG_LETTER_PAGE_WARN = 10;

// ---------------------------------------------------------------------------
// Pagination helpers
// chars that comfortably fit per page at ~11.5px Georgia with these margins
// ---------------------------------------------------------------------------
const CHARS_P1_HRT = 1600;
const CHARS_P1_TRT = 1800;
const CHARS_PX     = 2100;

function paginateText(text, charsP1) {
  if (!text) return [text];
  const pages = [];
  pages.push(text.slice(0, charsP1));
  let rest = text.slice(charsP1);
  while (rest.length > 0) {
    pages.push(rest.slice(0, CHARS_PX));
    rest = rest.slice(CHARS_PX);
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Letterhead page (first page — uses real template image as background)
// ---------------------------------------------------------------------------
const LetterheadPage = ({ bg, body, signer, headerEndPct, footerStartPct, isLastPage }) => (
  <div
    style={{
      width: "100%",
      aspectRatio: "1242 / 1755",
      backgroundImage: `url(${bg})`,
      backgroundSize: "100% 100%",
      backgroundRepeat: "no-repeat",
      position: "relative",
      fontFamily: "Georgia, serif",
      fontSize: "clamp(8px, 1.1vw, 13px)",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: `${headerEndPct}%`,
        bottom: `${100 - footerStartPct}%`,
        left: "9%",
        right: "8%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.75", color: "#1a1a1a", flex: 1, overflow: "hidden" }}>
        {body || <span style={{ color: "#bbb", fontStyle: "italic" }}>Start typing in the editor...</span>}
      </div>
      {isLastPage && signer && (
        <div style={{ marginTop: "4%", flexShrink: 0 }}>
          <div style={{ fontWeight: "700", color: "#111" }}>{signer.name}</div>
          <div style={{ color: "#555", fontSize: "0.9em" }}>{signer.title}</div>
        </div>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Continuation page (plain white, no letterhead graphic)
// ---------------------------------------------------------------------------
const ContinuationPage = ({ body, signer, isLastPage }) => (
  <div
    style={{
      width: "100%",
      aspectRatio: "1242 / 1755",
      background: "white",
      position: "relative",
      fontFamily: "Georgia, serif",
      fontSize: "clamp(8px, 1.1vw, 13px)",
      flexShrink: 0,
    }}
  >
    <div style={{ position: "absolute", top: "4%", bottom: "8%", left: "9%", right: "8%", display: "flex", flexDirection: "column" }}>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.75", color: "#1a1a1a", flex: 1, overflow: "hidden" }}>
        {body}
      </div>
      {isLastPage && signer && (
        <div style={{ marginTop: "4%", flexShrink: 0 }}>
          <div style={{ fontWeight: "700", color: "#111" }}>{signer.name}</div>
          <div style={{ color: "#555", fontSize: "0.9em" }}>{signer.title}</div>
        </div>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function getStoredDark() {
  try {
    const v = localStorage.getItem("fountain_dark");
    return v === "true";
  } catch (_) { return false; }
}

export default function App() {
  const [template, setTemplate]               = useState("HRT");
  const [body, setBody]                       = useState("");
  const [signers, setSigners]                 = useState([
    { id: 1, name: "Doron Stember",   title: "Chief Medical Officer" },
    { id: 2, name: "Lindsay Burden",  title: "Chief Clinical Operations Officer" },
    { id: 3, name: "Brandon Shrair",  title: "CEO" },
  ]);
  const [selectedSignerId, setSelectedSignerId] = useState(null);
  const [newSignerName, setNewSignerName]       = useState("");
  const [newSignerTitle, setNewSignerTitle]     = useState("");
  const [showAddSigner, setShowAddSigner]       = useState(false);
  const [addSignerError, setAddSignerError]     = useState("");
  const [tab, setTab]                           = useState("compose");
  const [dark, setDark]                         = useState(getStoredDark);
  const [section, setSection]                   = useState("generator");
  const [contactForm, setContactForm]           = useState({ name: "", email: "", message: "" });
  const [contactSent, setContactSent]           = useState(false);
  const [savedDraft, setSavedDraft]             = useState(null);
  const [copyStatus, setCopyStatus]            = useState(null); // "copied" | "failed" | null
  const [pdfNote, setPdfNote]                  = useState(false);
  const [previewScale, setPreviewScale]        = useState(() => {
    try { const v = localStorage.getItem("fountain_preview_scale"); if (v) return Math.max(0.6, Math.min(1.5, Number(v))); } catch (_) {}
    return 1;
  });
  const previewRef = useRef();
  const previewScrollRef = useRef();
  const previewZoomWrapperRef = useRef();
  const mainContentRef = useRef();

  // ── Persist dark mode ─────────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem("fountain_dark", dark ? "true" : "false"); } catch (_) {}
  }, [dark]);

  // ── Persist preview zoom ──────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem("fountain_preview_scale", String(previewScale)); } catch (_) {}
  }, [previewScale]);

  // ── Auto-save / restore ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fountain_draft");
      if (raw) setSavedDraft(JSON.parse(raw));
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!body && selectedSignerId == null) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          "fountain_draft",
          JSON.stringify({ body, template, selectedSignerId, savedAt: new Date().toISOString() })
        );
      } catch (_) {}
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [body, template, selectedSignerId]);

  // ── Focus main content when section changes ───────────────────────────────
  useEffect(() => {
    mainContentRef.current?.focus?.();
  }, [section]);

  const restoreDraft = () => {
    if (!savedDraft) return;
    setBody(savedDraft.body || "");
    setTemplate(savedDraft.template || "HRT");
    setSelectedSignerId(savedDraft.selectedSignerId || null);
    setSavedDraft(null);
  };

  // ── Derived state ────────────────────────────────────────────────────────
  const isHRT       = template === "HRT";
  const accent      = "#0D6EFD";
  const accentGrad  = "linear-gradient(135deg, #0D6EFD, #0DCAF0)";
  const charsP1     = isHRT ? CHARS_P1_HRT : CHARS_P1_TRT;
  const pages       = paginateText(body, charsP1);
  const overflowWarn = body.length > charsP1 * 0.9 && pages.length === 1;
  const isMultiPage  = pages.length > 1;
  const longLetterWarn = pages.length > LONG_LETTER_PAGE_WARN;
  const activeSigner = signers.find((s) => s.id === selectedSignerId) || null;

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const T = dark
    ? {
        bg: "#0d1117", panel: "#161b22", border: "#30363d",
        text: "#e6edf3", textMuted: "#8b949e",
        input: "#0d1117", inputBorder: "#30363d", card: "#0d1117",
        topbar: "#161b22", preview: "#0d1117", previewLabel: "#484f58",
        tabInactive: "#8b949e",
        wordBtn: { border: "#30363d", color: "#8b949e" },
      }
    : {
        bg: "#EEF4FB", panel: "#ffffff", border: "#D0E2F3",
        text: "#0D2B4E", textMuted: "#4A6580",
        input: "#F5F9FE", inputBorder: "#C2D8EE", card: "#F5F9FE",
        topbar: "#ffffff", preview: "#EEF4FB", previewLabel: "#6B8BAA",
        tabInactive: "#6B8BAA",
        wordBtn: { border: "#C2D8EE", color: "#4A6580" },
      };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const addSigner = () => {
    const name = newSignerName.trim();
    const title = newSignerTitle.trim();
    if (!name) { setAddSignerError("Name is required."); return; }
    if (!title) { setAddSignerError("Title is required."); return; }
    setAddSignerError("");
    setSigners((p) => [...p, { id: Date.now(), name, title }]);
    setNewSignerName(""); setNewSignerTitle(""); setShowAddSigner(false);
  };

  const copyToClipboard = () => {
    setCopyStatus(null);
    navigator.clipboard.writeText(body).then(() => {
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus(null), 2000);
    }).catch(() => {
      setCopyStatus("failed");
      setTimeout(() => setCopyStatus(null), 3000);
    });
  };

  const startFresh = () => {
    setBody("");
    setSelectedSignerId(null);
  };

  const scrollPreviewTo = (position) => {
    const el = previewScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: position === "first" ? 0 : el.scrollHeight, behavior: "smooth" });
  };

  const handleExportPDF = async () => {
    const container = previewRef.current;
    if (!container || !container.children.length) return;
    setPdfNote(true);
    const zoomWrapper = previewZoomWrapperRef.current;
    if (zoomWrapper) zoomWrapper.style.zoom = "1";
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const pdf = new jsPDF("p", "pt", "a4");
      const a4W = pdf.internal.pageSize.getWidth();
      const a4H = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < container.children.length; i++) {
        const pageEl = container.children[i];
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });
        const imgW = a4W;
        const imgH = (canvas.height * a4W) / canvas.width;
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, Math.min(imgH, a4H));
      }
      pdf.save(`fountain-${template.toLowerCase()}-letter-${dateStr}.pdf`);
    } catch (_) {
      if (zoomWrapper) zoomWrapper.style.zoom = String(previewScale);
      setPdfNote(false);
      return;
    }
    if (zoomWrapper) zoomWrapper.style.zoom = String(previewScale);
    setPdfNote(false);
  };

  const handleExportWord = () => {
    const content = previewRef.current?.innerHTML;
    if (!content) return;
    const blob = new Blob(
      [`<!DOCTYPE html><html><body>${content}</body></html>`],
      { type: "application/msword" }
    );
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fountain-${template.toLowerCase()}-letter-${dateStr}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const exportFilename = (ext) => `fountain-${template.toLowerCase()}-letter-${dateStr}.${ext}`;

  const handleExportText = () => {
    let text = body || "";
    if (activeSigner) text += (text ? "\n\n" : "") + `${activeSigner.name}\n${activeSigner.title}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename("txt");
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeRtf = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
  const handleExportRTF = () => {
    const parts = ["{\\rtf1\\ansi\\deff0", "{\\fonttbl{\\f0 Times New Roman;}}", "\\f0\\fs24"];
    const escaped = escapeRtf(body).replace(/\n/g, "\\par\n");
    parts.push(escaped);
    if (activeSigner) {
      parts.push("\\par\\par");
      parts.push("\\b " + escapeRtf(activeSigner.name) + "\\b0\\par");
      parts.push(escapeRtf(activeSigner.title));
    }
    parts.push("}");
    const blob = new Blob([parts.join("\n")], { type: "application/rtf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename("rtf");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = () => {
    const content = previewRef.current?.innerHTML;
    if (!content) return;
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fountain Letter</title><style>body{font-family:Georgia,serif;max-width:720px;margin:24px auto;padding:0 16px;}</style></head><body>${content}</body></html>`;
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename("html");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContactSubmit = () => {
    if (!contactForm.message.trim()) return;
    const subj = encodeURIComponent("Fountain Doc Generator — Suggestion");
    const bod  = encodeURIComponent(`From: ${contactForm.name} <${contactForm.email}>\n\n${contactForm.message}`);
    window.open(`mailto:daniel@fountain.net?subject=${subj}&body=${bod}`);
    setContactSent(true);
    setContactForm({ name: "", email: "", message: "" });
  };

  // ── Shared style helpers ─────────────────────────────────────────────────
  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: `1px solid ${T.inputBorder}`, background: T.input,
    color: T.text, fontSize: "13px", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s",
  };

  const labelStyle = {
    fontSize: "10.5px", fontWeight: "700", color: T.textMuted,
    letterSpacing: "0.1em", textTransform: "uppercase",
    display: "block", marginBottom: "7px",
  };

  const pageShadow = dark
    ? "0 6px 40px rgba(0,0,0,0.5)"
    : "0 6px 40px rgba(13,43,78,0.12), 0 0 0 1px rgba(194,216,238,0.8)";

  const navItems = [
    ["generator", "📄 Generator"],
    ["howto",     "📖 How to Use"],
    ["contact",   "💬 Suggestions"],
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={mainContentRef} tabIndex={-1} style={{ minHeight: "100vh", height: "100vh", background: T.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", display: "flex", flexDirection: "column", transition: "background 0.3s", overflow: "hidden", outline: "none" }}>

      {/* ── Top bar ── */}
      <div style={{ background: T.topbar, borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px", flexShrink: 0, boxShadow: dark ? "none" : "0 1px 8px rgba(13,43,78,0.06)", transition: "background 0.3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src={LOGO} alt="Fountain" style={{ height: "28px", objectFit: "contain" }} />
          <span style={{ color: T.textMuted, fontSize: "13px", paddingLeft: "10px", borderLeft: `1px solid ${T.border}` }}>Doc Generator</span>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          {navItems.map(([id, label]) => (
            <button key={id} onClick={() => setSection(id)} style={{
              padding: "6px 14px", borderRadius: "7px", border: "none",
              background: section === id ? (dark ? "#1f2937" : "#EEF4FB") : "transparent",
              color: section === id ? accent : T.tabInactive,
              fontWeight: section === id ? "700" : "500",
              fontSize: "12.5px", cursor: "pointer", transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" onClick={() => setDark((d) => !d)} title={dark ? "Light mode" : "Dark mode"} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} style={{ width: "36px", height: "36px", borderRadius: "8px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark ? "☀️" : "🌙"}
          </button>
          {section === "generator" && (
            <>
              <button type="button" onClick={handleExportWord} style={{ padding: "7px 12px", borderRadius: "8px", border: `1px solid ${T.wordBtn.border}`, background: "transparent", color: T.wordBtn.color, fontSize: "12px", cursor: "pointer", fontWeight: "500" }}>⬇ Word</button>
              <button type="button" onClick={handleExportText} style={{ padding: "7px 12px", borderRadius: "8px", border: `1px solid ${T.wordBtn.border}`, background: "transparent", color: T.wordBtn.color, fontSize: "12px", cursor: "pointer", fontWeight: "500" }}>⬇ Text</button>
              <button type="button" onClick={handleExportRTF} style={{ padding: "7px 12px", borderRadius: "8px", border: `1px solid ${T.wordBtn.border}`, background: "transparent", color: T.wordBtn.color, fontSize: "12px", cursor: "pointer", fontWeight: "500" }}>⬇ RTF</button>
              <button type="button" onClick={handleExportHTML} style={{ padding: "7px 12px", borderRadius: "8px", border: `1px solid ${T.wordBtn.border}`, background: "transparent", color: T.wordBtn.color, fontSize: "12px", cursor: "pointer", fontWeight: "500" }}>⬇ HTML</button>
              <button type="button" onClick={handleExportPDF} style={{ padding: "7px 18px", borderRadius: "8px", border: "none", background: accentGrad, color: "white", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>⬇ PDF</button>
            </>
          )}
        </div>
      </div>

      {/* ── Draft restore banner ── */}
      {savedDraft && section === "generator" && (
        <div style={{ background: dark ? "#1a2332" : "#dbeafe", borderBottom: `1px solid ${dark ? "#2a3a52" : "#93c5fd"}`, padding: "8px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: "12.5px", color: dark ? "#93c5fd" : "#1d4ed8", fontWeight: "500" }}>
            📋 Saved draft from {new Date(savedDraft.savedAt).toLocaleString()}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={restoreDraft} style={{ padding: "4px 12px", borderRadius: "6px", border: "none", background: accent, color: "white", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Restore</button>
            <button onClick={() => setSavedDraft(null)} style={{ padding: "4px 12px", borderRadius: "6px", border: `1px solid ${dark ? "#2a3a52" : "#93c5fd"}`, background: "transparent", color: dark ? "#93c5fd" : "#1d4ed8", fontSize: "12px", cursor: "pointer" }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* ── PDF export note ── */}
      {pdfNote && section === "generator" && (
        <div style={{ background: dark ? "#1e3a5f" : "#dbeafe", borderBottom: `1px solid ${dark ? "#2563eb" : "#93c5fd"}`, padding: "8px 24px", flexShrink: 0 }}>
          <span style={{ fontSize: "12.5px", color: dark ? "#93c5fd" : "#1d4ed8" }}>
            Preparing PDF download…
          </span>
        </div>
      )}

      {/* ══════════════ GENERATOR ══════════════ */}
      {section === "generator" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Left panel */}
          <div style={{ width: "340px", flexShrink: 0, background: T.panel, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", transition: "background 0.3s" }}>

            {/* Template toggle */}
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", background: T.bg, borderRadius: "9px", padding: "3px", gap: "2px", border: `1px solid ${T.border}` }}>
                {["HRT", "TRT"].map((t) => (
                  <button key={t} onClick={() => setTemplate(t)} style={{
                    flex: 1, padding: "7px 0", borderRadius: "7px", border: "none", cursor: "pointer",
                    fontWeight: "600", fontSize: "12.5px", transition: "all 0.25s",
                    background: template === t ? accentGrad : "transparent",
                    color: template === t ? "white" : T.tabInactive,
                  }}>{t} Letterhead</button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
              {[["compose", "✍ Compose"], ["signers", "👤 Signers"]].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  flex: 1, padding: "11px 0", border: "none", background: "transparent",
                  color: tab === id ? accent : T.tabInactive,
                  fontWeight: tab === id ? "700" : "500", fontSize: "12px", cursor: "pointer",
                  borderBottom: tab === id ? `2px solid ${accent}` : "2px solid transparent",
                  marginBottom: "-1px", transition: "all 0.2s",
                }}>{label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>

              {/* ── Compose tab ── */}
              {tab === "compose" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                  {/* Body */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px", flexWrap: "wrap", gap: "6px" }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Letter Body</label>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {body.trim() && (
                          <button type="button" onClick={startFresh} style={{ padding: "3px 10px", borderRadius: "6px", border: `1px solid ${T.inputBorder}`, background: T.input, color: T.textMuted, fontSize: "11px", cursor: "pointer", fontWeight: "600" }}>
                            Start fresh
                          </button>
                        )}
                        <button type="button" onClick={copyToClipboard} style={{ padding: "3px 10px", borderRadius: "6px", border: `1px solid ${T.inputBorder}`, background: copyStatus === "copied" ? "#d1fae5" : copyStatus === "failed" ? "#fef2f2" : T.input, color: copyStatus === "copied" ? "#065f46" : copyStatus === "failed" ? "#b91c1c" : T.textMuted, fontSize: "11px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}>
                          {copyStatus === "copied" ? "✓ Copied!" : copyStatus === "failed" ? "Copy failed" : "⎘ Copy"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={"Dear [Recipient],\n\nTo Whom It May Concern,\n\n[Your letter content here...]\n\nSincerely,"}
                      onFocus={(e) => (e.target.style.borderColor = accent)}
                      onBlur={(e)  => (e.target.style.borderColor = T.inputBorder)}
                      style={{ ...inputStyle, minHeight: "280px", resize: "vertical", lineHeight: "1.7", fontFamily: "Georgia, serif" }}
                    />
                    <div style={{ marginTop: "5px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                      {overflowWarn && !isMultiPage && <span style={{ fontSize: "10.5px", color: "#f59e0b", fontWeight: "600" }}>⚠ Approaching page limit</span>}
                      {longLetterWarn && <span style={{ fontSize: "10.5px", color: "#b45309", fontWeight: "600" }}>Very long letter — consider splitting</span>}
                      {isMultiPage  && !longLetterWarn && <span style={{ fontSize: "10.5px", color: accent, fontWeight: "600" }}>📄 {pages.length} pages</span>}
                      {!overflowWarn && !isMultiPage && !longLetterWarn && <span />}
                      <span style={{ fontSize: "10px", color: T.textMuted }}>{body.length} chars</span>
                    </div>
                  </div>

                  {/* Signer */}
                  <div>
                    <label style={labelStyle}>Signer</label>
                    <select
                      value={selectedSignerId || ""}
                      onChange={(e) => setSelectedSignerId(e.target.value ? Number(e.target.value) : null)}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="">— No signer —</option>
                      {signers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.title ? ` · ${s.title}` : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ── Signers tab ── */}
              {tab === "signers" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={labelStyle}>{signers.length} Signer{signers.length !== 1 ? "s" : ""}</span>
                    <button type="button" onClick={() => { setShowAddSigner((p) => !p); setAddSignerError(""); }} style={{ padding: "6px 12px", borderRadius: "7px", border: showAddSigner ? `1px solid ${T.border}` : "none", background: showAddSigner ? T.card : accentGrad, color: showAddSigner ? T.textMuted : "white", fontSize: "11.5px", cursor: "pointer", fontWeight: "600" }}>
                      {showAddSigner ? "✕ Cancel" : "+ Add Signer"}
                    </button>
                  </div>

                  {showAddSigner && (
                    <div style={{ background: T.card, border: `1px solid ${accent}40`, borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <input placeholder="Full name" value={newSignerName} onChange={(e) => setNewSignerName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSigner()} onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = T.inputBorder)} style={inputStyle} aria-invalid={!!addSignerError} />
                      <input placeholder="Title (e.g. NP, Medical Director)" value={newSignerTitle} onChange={(e) => setNewSignerTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSigner()} onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = T.inputBorder)} style={inputStyle} aria-invalid={!!addSignerError} />
                      {addSignerError && <span style={{ fontSize: "11px", color: "#b91c1c", fontWeight: "600" }}>{addSignerError}</span>}
                      <button type="button" onClick={addSigner} style={{ padding: "9px", borderRadius: "7px", border: "none", background: accentGrad, color: "white", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }}>Add Signer</button>
                    </div>
                  )}

                  {signers.length === 0 && !showAddSigner && (
                    <div style={{ background: T.card, borderRadius: "10px", padding: "28px", textAlign: "center", border: `1px dashed ${T.border}` }}>
                      <div style={{ fontSize: "26px", marginBottom: "8px" }}>✍️</div>
                      <div style={{ color: T.textMuted, fontSize: "12px" }}>No signers yet.</div>
                    </div>
                  )}

                  {signers.map((s) => (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSignerId(selectedSignerId === s.id ? null : s.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSignerId(selectedSignerId === s.id ? null : s.id); } }}
                      aria-pressed={selectedSignerId === s.id}
                      aria-label={`${s.name}, ${s.title || "No title"}. ${selectedSignerId === s.id ? "Selected" : "Click to select"}`}
                      style={{ background: selectedSignerId === s.id ? `${accent}12` : T.card, border: `1px solid ${selectedSignerId === s.id ? accent + "50" : T.border}`, borderRadius: "10px", padding: "11px 13px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}
                    >
                      <div>
                        <div style={{ color: T.text, fontWeight: "600", fontSize: "13px" }}>{s.name}</div>
                        <div style={{ color: T.textMuted, fontSize: "11px", marginTop: "2px" }}>{s.title || "No title"}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {selectedSignerId === s.id && <span style={{ fontSize: "10px", color: accent, fontWeight: "700", background: `${accent}15`, padding: "3px 8px", borderRadius: "20px" }}>Selected</span>}
                        <button type="button" aria-label={`Remove ${s.name}`} onClick={(e) => { e.stopPropagation(); if (selectedSignerId === s.id) setSelectedSignerId(null); setSigners((p) => p.filter((x) => x.id !== s.id)); }} style={{ background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: "14px" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div
            ref={previewScrollRef}
            role="region"
            aria-label="Letter preview"
            style={{ flex: 1, background: T.preview, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 24px", transition: "background 0.3s" }}
          >
            <div style={{ position: "sticky", top: 0, zIndex: 2, background: T.preview, paddingBottom: "12px", marginBottom: "4px", width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "stretch" }}>
              <div style={{ fontSize: "10px", color: T.previewLabel, fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", paddingLeft: "4px" }}>
                Preview · {template} Letterhead{isMultiPage ? ` · ${pages.length} pages` : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <button type="button" onClick={() => scrollPreviewTo("first")} aria-label="Scroll to first page" style={{ padding: "5px 10px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.panel, color: T.textMuted, fontSize: "11px", cursor: "pointer", fontWeight: "500" }}>↑ First page</button>
                <button type="button" onClick={() => scrollPreviewTo("last")} aria-label="Scroll to last page" style={{ padding: "5px 10px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.panel, color: T.textMuted, fontSize: "11px", cursor: "pointer", fontWeight: "500" }}>↓ Last page</button>
                <span style={{ width: "1px", height: "18px", background: T.border, marginLeft: "4px" }} />
                <span style={{ fontSize: "11px", color: T.previewLabel, marginRight: "4px" }}>Zoom:</span>
                {[0.8, 1, 1.25].map((s) => (
                  <button key={s} type="button" onClick={() => setPreviewScale(s)} aria-label={`Zoom ${s * 100}%`} aria-pressed={previewScale === s} style={{ padding: "5px 10px", borderRadius: "6px", border: `1px solid ${previewScale === s ? accent : T.border}`, background: previewScale === s ? (dark ? "rgba(13,110,253,0.2)" : "#e8f0fe") : T.panel, color: previewScale === s ? accent : T.textMuted, fontSize: "11px", cursor: "pointer", fontWeight: "500" }}>
                    {s === 1 ? "100%" : `${s * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            <div ref={previewZoomWrapperRef} style={{ zoom: previewScale, width: "100%", maxWidth: "720px" }}>
              <div ref={previewRef} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
                {pages.map((pageBody, i) => {
                  const isFirst = i === 0;
                  const isLast  = i === pages.length - 1;
                  return (
                    <div key={i} style={{ boxShadow: pageShadow, borderRadius: "3px", overflow: "hidden" }}>
                      {isFirst ? (
                        <LetterheadPage
                          bg={isHRT ? HRT_BG : TRT_BG}
                          body={pageBody}
                          signer={activeSigner}
                          headerEndPct={isHRT ? 22 : 14.5}
                          footerStartPct={89.9}
                          isLastPage={isLast}
                        />
                      ) : (
                        <ContinuationPage body={pageBody} signer={activeSigner} isLastPage={isLast} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ HOW TO USE ══════════════ */}
      {section === "howto" && (
        <div style={{ flex: 1, overflow: "auto", padding: "48px 24px", display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: "720px", width: "100%" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: T.text, marginBottom: "8px", letterSpacing: "-0.5px" }}>How to Use Fountain Doc Generator</h1>
            <p style={{ color: T.textMuted, fontSize: "14px", marginBottom: "40px", lineHeight: "1.6" }}>Generate professional Fountain letterhead documents in seconds, ready for DocuSign.</p>

            {[
              { step: "1", icon: "📋", title: "Choose a Letterhead",        desc: "Select either HRT or TRT letterhead using the toggle in the left panel. The preview updates instantly." },
              { step: "2", icon: "✍️", title: "Write Your Letter", desc: "Type or paste your letter in the Letter Body area. Replace any [BRACKETED] placeholders before exporting." },
              { step: "3", icon: "👤", title: "Select a Signer",             desc: "Choose a signer from the dropdown. Their name and title will appear at the bottom of the letter. Manage signers in the Signers tab." },
              { step: "4", icon: "📄", title: "Review the Live Preview",     desc: "The preview updates as you type. Long letters automatically flow onto a second page. A warning appears when you're approaching the page limit." },
              { step: "5", icon: "⬇️", title: "Export Your Document",        desc: "Click PDF to open a print dialog and save as PDF. Click Word to download a .doc file. Both are ready to upload directly to DocuSign." },
              { step: "6", icon: "💾", title: "Auto-Save",                   desc: "Your draft is automatically saved as you type. If you close the tab, a restore banner will appear when you return." },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} style={{ display: "flex", gap: "20px", marginBottom: "20px", padding: "20px 24px", background: T.panel, borderRadius: "12px", border: `1px solid ${T.border}`, transition: "background 0.3s" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: accentGrad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: "11px", color: accent, fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>Step {step}</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: T.text, marginBottom: "6px" }}>{title}</div>
                  <div style={{ fontSize: "13.5px", color: T.textMuted, lineHeight: "1.65" }}>{desc}</div>
                </div>
              </div>
            ))}

            <div style={{ background: dark ? "#1a2332" : "#dbeafe", borderRadius: "12px", padding: "20px 24px", border: `1px solid ${dark ? "#2a3a52" : "#93c5fd"}` }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: dark ? "#93c5fd" : "#1d4ed8", marginBottom: "8px" }}>💡 Pro Tips</div>
              <ul style={{ color: dark ? "#6ea8fe" : "#1e40af", fontSize: "13px", lineHeight: "1.9", paddingLeft: "18px", margin: 0 }}>
                <li>Use the ⎘ Copy button to paste letter text directly into Intercom.</li>
                <li>Replace all bracketed fields like [PATIENT NAME] before exporting.</li>
                <li>Long letters auto-paginate — scroll the preview to see all pages.</li>
                <li>Have a suggestion? Use the Suggestions tab to send feedback to Daniel.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ SUGGESTIONS ══════════════ */}
      {section === "contact" && (
        <div style={{ flex: 1, overflow: "auto", padding: "48px 24px", display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: "560px", width: "100%" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: T.text, marginBottom: "8px", letterSpacing: "-0.5px" }}>Send a Suggestion</h1>
            <p style={{ color: T.textMuted, fontSize: "14px", marginBottom: "32px", lineHeight: "1.6" }}>Have an idea or found something broken? All feedback goes directly to Daniel.</p>

            {contactSent ? (
              <div style={{ background: dark ? "#052e16" : "#d1fae5", borderRadius: "12px", padding: "32px", textAlign: "center", border: `1px solid ${dark ? "#166534" : "#6ee7b7"}` }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>✅</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: dark ? "#6ee7b7" : "#065f46", marginBottom: "8px" }}>Message Sent!</div>
                <div style={{ fontSize: "13px", color: dark ? "#4ade80" : "#047857" }}>Your email client opened to send feedback to daniel@fountain.net.</div>
                <button onClick={() => setContactSent(false)} style={{ marginTop: "20px", padding: "8px 20px", borderRadius: "8px", border: "none", background: accentGrad, color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Send Another</button>
              </div>
            ) : (
              <div style={{ background: T.panel, borderRadius: "16px", padding: "28px", border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: "16px", transition: "background 0.3s" }}>
                <div>
                  <label style={labelStyle}>Your Name</label>
                  <input placeholder="Full name" value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = T.inputBorder)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Your Email</label>
                  <input placeholder="you@fountain.net" type="email" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = T.inputBorder)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Suggestion or Feedback</label>
                  <textarea placeholder="Describe your idea or the issue..." value={contactForm.message} onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))} onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = T.inputBorder)} style={{ ...inputStyle, minHeight: "140px", resize: "vertical", lineHeight: "1.65" }} />
                </div>
                <button onClick={handleContactSubmit} disabled={!contactForm.message.trim()} style={{ padding: "11px", borderRadius: "9px", border: "none", background: contactForm.message.trim() ? accentGrad : T.card, color: contactForm.message.trim() ? "white" : T.textMuted, fontWeight: "700", fontSize: "13.5px", cursor: contactForm.message.trim() ? "pointer" : "default", transition: "all 0.2s" }}>
                  Send to daniel@fountain.net →
                </button>
                <p style={{ fontSize: "11px", color: T.textMuted, textAlign: "center", margin: 0 }}>This will open your default email client.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
