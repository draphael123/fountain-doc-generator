import { useState, useRef, useEffect } from "react";

const HRT_BG = "/hrt_letterhead.png";
const TRT_BG = "/trt_letterhead.png";
const LOGO   = "/logo.png";

// ---------------------------------------------------------------------------
// Snippet templates
// ---------------------------------------------------------------------------
const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const SNIPPETS = [
  {
    label: "Prior Authorization",
    text: `Date: ${today}\n\nTo Whom It May Concern,\n\nWe are writing to request prior authorization for [PATIENT NAME], Date of Birth: [DOB], for the following treatment: [TREATMENT/MEDICATION].\n\nThe patient has been evaluated and it is our clinical determination that this treatment is medically necessary due to [CLINICAL REASON].\n\nPlease find attached supporting clinical documentation. We respectfully request expedited review given the medical urgency of this case.\n\nThank you for your prompt attention to this matter. Please do not hesitate to contact our office at support@fountain.net with any questions.\n\nSincerely,`,
  },
  {
    label: "Medical Necessity",
    text: `Date: ${today}\n\nTo Whom It May Concern,\n\nThis letter serves to document the medical necessity of [TREATMENT/MEDICATION] for our patient, [PATIENT NAME], Date of Birth: [DOB].\n\n[PATIENT NAME] has been under our care since [DATE] and presents with [DIAGNOSIS/CONDITION]. After thorough clinical evaluation, we have determined that [TREATMENT/MEDICATION] is medically necessary for the following reasons:\n\n1. [CLINICAL REASON 1]\n2. [CLINICAL REASON 2]\n3. [CLINICAL REASON 3]\n\nAlternative treatments including [ALTERNATIVES] have been considered and deemed insufficient due to [REASON].\n\nIt is our professional medical opinion that proceeding with this treatment is in the best interest of the patient\'s health and well-being.\n\nSincerely,`,
  },
  {
    label: "Prescription Letter",
    text: `Date: ${today}\n\nTo Whom It May Concern,\n\nThis letter confirms that [PATIENT NAME], Date of Birth: [DOB], is currently under the care of Fountain Health and has been prescribed the following:\n\nMedication: [MEDICATION NAME]\nDosage: [DOSAGE]\nFrequency: [FREQUENCY]\nDuration: [DURATION]\n\nThis prescription has been issued following a thorough clinical evaluation and is medically indicated for the treatment of [CONDITION].\n\nIf you have any questions regarding this prescription, please contact our office at support@fountain.net or (213) 237-1454.\n\nSincerely,`,
  },
];

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
  const [tab, setTab]                           = useState("compose");
  const [dark, setDark]                         = useState(false);
  const [section, setSection]                   = useState("generator");
  const [contactForm, setContactForm]           = useState({ name: "", email: "", message: "" });
  const [contactSent, setContactSent]           = useState(false);
  const [savedDraft, setSavedDraft]             = useState(null);
  const [copySuccess, setCopySuccess]           = useState(false);
  const previewRef = useRef();

  // ── Auto-save / restore ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fountain_draft");
      if (raw) setSavedDraft(JSON.parse(raw));
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (body || selectedSignerId) {
      localStorage.setItem(
        "fountain_draft",
        JSON.stringify({ body, template, selectedSignerId, savedAt: new Date().toISOString() })
      );
    }
  }, [body, template, selectedSignerId]);

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
    if (!newSignerName.trim()) return;
    setSigners((p) => [...p, { id: Date.now(), name: newSignerName.trim(), title: newSignerTitle.trim() }]);
    setNewSignerName(""); setNewSignerTitle(""); setShowAddSigner(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(body).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleExportPDF = () => {
    const content = previewRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(
      `<!DOCTYPE html><html><head><title>Fountain Letter</title>
       <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:white;}
       @media print{@page{margin:0;}}</style>
       </head><body>${content}<script>window.onload=function(){window.print();}<\/script></body></html>`
    );
    win.document.close();
  };

  const handleExportWord = () => {
    const content = previewRef.current?.innerHTML;
    if (!content) return;
    const blob = new Blob(
      [`<!DOCTYPE html><html><body>${content}</body></html>`],
      { type: "application/msword" }
    );
    Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `fountain-${template.toLowerCase()}-letter.doc`,
    }).click();
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
    <div style={{ minHeight: "100vh", height: "100vh", background: T.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", display: "flex", flexDirection: "column", transition: "background 0.3s", overflow: "hidden" }}>

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
          <button onClick={() => setDark((d) => !d)} title={dark ? "Light mode" : "Dark mode"} style={{ width: "36px", height: "36px", borderRadius: "8px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark ? "☀️" : "🌙"}
          </button>
          {section === "generator" && (
            <>
              <button onClick={handleExportWord} style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${T.wordBtn.border}`, background: "transparent", color: T.wordBtn.color, fontSize: "12px", cursor: "pointer", fontWeight: "500" }}>⬇ Word</button>
              <button onClick={handleExportPDF}  style={{ padding: "7px 18px", borderRadius: "8px", border: "none", background: accentGrad, color: "white", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>⬇ PDF</button>
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

                  {/* Quick templates */}
                  <div>
                    <label style={labelStyle}>Quick Templates</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {SNIPPETS.map((s) => (
                        <button key={s.label} onClick={() => setBody(s.text)}
                          onMouseEnter={(e) => (e.target.style.borderColor = accent)}
                          onMouseLeave={(e) => (e.target.style.borderColor = T.inputBorder)}
                          style={{ padding: "7px 12px", borderRadius: "7px", border: `1px solid ${T.inputBorder}`, background: T.input, color: T.text, fontSize: "12px", cursor: "pointer", textAlign: "left", fontWeight: "500", transition: "border-color 0.2s" }}
                        >📄 {s.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Body */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Letter Body</label>
                      <button onClick={copyToClipboard} style={{ padding: "3px 10px", borderRadius: "6px", border: `1px solid ${T.inputBorder}`, background: copySuccess ? "#d1fae5" : T.input, color: copySuccess ? "#065f46" : T.textMuted, fontSize: "11px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}>
                        {copySuccess ? "✓ Copied!" : "⎘ Copy"}
                      </button>
                    </div>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={"Dear [Recipient],\n\nTo Whom It May Concern,\n\n[Your letter content here...]\n\nSincerely,"}
                      onFocus={(e) => (e.target.style.borderColor = accent)}
                      onBlur={(e)  => (e.target.style.borderColor = T.inputBorder)}
                      style={{ ...inputStyle, minHeight: "280px", resize: "vertical", lineHeight: "1.7", fontFamily: "Georgia, serif" }}
                    />
                    <div style={{ marginTop: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {overflowWarn && !isMultiPage && <span style={{ fontSize: "10.5px", color: "#f59e0b", fontWeight: "600" }}>⚠ Approaching page limit</span>}
                      {isMultiPage  && <span style={{ fontSize: "10.5px", color: accent, fontWeight: "600" }}>📄 {pages.length} pages</span>}
                      {!overflowWarn && !isMultiPage && <span />}
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
                    <button onClick={() => setShowAddSigner((p) => !p)} style={{ padding: "6px 12px", borderRadius: "7px", border: showAddSigner ? `1px solid ${T.border}` : "none", background: showAddSigner ? T.card : accentGrad, color: showAddSigner ? T.textMuted : "white", fontSize: "11.5px", cursor: "pointer", fontWeight: "600" }}>
                      {showAddSigner ? "✕ Cancel" : "+ Add Signer"}
                    </button>
                  </div>

                  {showAddSigner && (
                    <div style={{ background: T.card, border: `1px solid ${accent}40`, borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <input placeholder="Full name" value={newSignerName} onChange={(e) => setNewSignerName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSigner()} onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = T.inputBorder)} style={inputStyle} />
                      <input placeholder="Title (e.g. NP, Medical Director)" value={newSignerTitle} onChange={(e) => setNewSignerTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSigner()} onFocus={(e) => (e.target.style.borderColor = accent)} onBlur={(e) => (e.target.style.borderColor = T.inputBorder)} style={inputStyle} />
                      <button onClick={addSigner} style={{ padding: "9px", borderRadius: "7px", border: "none", background: accentGrad, color: "white", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }}>Add Signer</button>
                    </div>
                  )}

                  {signers.length === 0 && !showAddSigner && (
                    <div style={{ background: T.card, borderRadius: "10px", padding: "28px", textAlign: "center", border: `1px dashed ${T.border}` }}>
                      <div style={{ fontSize: "26px", marginBottom: "8px" }}>✍️</div>
                      <div style={{ color: T.textMuted, fontSize: "12px" }}>No signers yet.</div>
                    </div>
                  )}

                  {signers.map((s) => (
                    <div key={s.id} onClick={() => setSelectedSignerId(selectedSignerId === s.id ? null : s.id)} style={{ background: selectedSignerId === s.id ? `${accent}12` : T.card, border: `1px solid ${selectedSignerId === s.id ? accent + "50" : T.border}`, borderRadius: "10px", padding: "11px 13px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}>
                      <div>
                        <div style={{ color: T.text, fontWeight: "600", fontSize: "13px" }}>{s.name}</div>
                        <div style={{ color: T.textMuted, fontSize: "11px", marginTop: "2px" }}>{s.title || "No title"}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {selectedSignerId === s.id && <span style={{ fontSize: "10px", color: accent, fontWeight: "700", background: `${accent}15`, padding: "3px 8px", borderRadius: "20px" }}>Selected</span>}
                        <button onClick={(e) => { e.stopPropagation(); if (selectedSignerId === s.id) setSelectedSignerId(null); setSigners((p) => p.filter((x) => x.id !== s.id)); }} style={{ background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: "14px" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div style={{ flex: 1, background: T.preview, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 24px", transition: "background 0.3s" }}>
            <div style={{ fontSize: "10px", color: T.previewLabel, fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px", alignSelf: "flex-start", paddingLeft: "4px" }}>
              Preview · {template} Letterhead{isMultiPage ? ` · ${pages.length} pages` : ""}
            </div>

            <div ref={previewRef} style={{ width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "12px" }}>
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
      )}

      {/* ══════════════ HOW TO USE ══════════════ */}
      {section === "howto" && (
        <div style={{ flex: 1, overflow: "auto", padding: "48px 24px", display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: "720px", width: "100%" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: T.text, marginBottom: "8px", letterSpacing: "-0.5px" }}>How to Use Fountain Doc Generator</h1>
            <p style={{ color: T.textMuted, fontSize: "14px", marginBottom: "40px", lineHeight: "1.6" }}>Generate professional Fountain letterhead documents in seconds, ready for DocuSign.</p>

            {[
              { step: "1", icon: "📋", title: "Choose a Letterhead",        desc: "Select either HRT or TRT letterhead using the toggle in the left panel. The preview updates instantly." },
              { step: "2", icon: "✍️", title: "Use a Quick Template or Write from Scratch", desc: "Click one of the Quick Templates to pre-fill common boilerplate, then customize the bracketed fields. Or write your own letter in the body area." },
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
