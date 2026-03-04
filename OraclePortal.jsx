/**
 * OraclePortal — Framer Code Component
 *
 * A full-screen tarot oracle experience triggered from a nav item.
 * Paste this file into Framer as a code component.
 *
 * Props:
 *   cardImages  — JSON string mapping card names to upright/reversed image URLs.
 *                 e.g. { "The Fool": { "upright": "https://...", "reversed": "https://..." } }
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react"
import { addPropertyControls, ControlType } from "framer"

// ─── Design Tokens ────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#000000",
  primary: "#D4CFC9",
  secondary: "#7F7F7F",
  inputBg: "#404040",
  btnInactiveBg: "#1A1A1A",
  btnInactiveText: "#EAEAEA",
  btnActiveBg: "#D4CFC9",
  btnActiveText: "#1A1A1A",
}

// ─── Card Data ────────────────────────────────────────────────────────────────

const MAJOR_ARCANA = [
  { index: 0,  name: "The Fool" },
  { index: 1,  name: "The Magician" },
  { index: 2,  name: "The High Priestess" },
  { index: 3,  name: "The Empress" },
  { index: 4,  name: "The Emperor" },
  { index: 5,  name: "The Hierophant" },
  { index: 6,  name: "The Lovers" },
  { index: 7,  name: "The Chariot" },
  { index: 8,  name: "Strength" },
  { index: 9,  name: "The Hermit" },
  { index: 10, name: "Wheel of Fortune" },
  { index: 11, name: "Justice" },
  { index: 12, name: "The Hanged Man" },
  { index: 13, name: "Death" },
  { index: 14, name: "Temperance" },
  { index: 15, name: "The Devil" },
  { index: 16, name: "The Tower" },
  { index: 17, name: "The Star" },
  { index: 18, name: "The Moon" },
  { index: 19, name: "The Sun" },
  { index: 20, name: "Judgement" },
  { index: 21, name: "The World" },
]

// Indices weighted upward for positive-sentiment queries
const POSITIVE_INDICES = new Set([0, 1, 2, 3, 6, 7, 8, 10, 14, 17, 19, 20, 21])
// Indices weighted upward for negative-sentiment queries
const SHADOW_INDICES   = new Set([13, 15, 16, 18])

// Easter egg — checked case-insensitively against partial matches
const EASTER_EGG_KEYWORDS = [
  "ray", "portfolio", "designer", "ideal candidate", "hire", "job",
]
// Moon (18), Hermit (9), Wheel of Fortune (10) — always upright for easter egg
const EASTER_EGG_INDICES = [18, 9, 10]

const SESSION_KEY = "oracle_reading"
const PROXY_URL   =
  "https://oracle-proxy-63hohlnl9-ray-rains-projects.vercel.app/api/reading"

// ─── Sentiment ────────────────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  "love","hope","joy","happy","success","achieve","dream","wish","help","grow",
  "create","beautiful","wonderful","amazing","good","great","best","win","gain",
  "start","begin","new","bright","light","free","peace","harmony","heal","rise",
  "inspire","passion","courage","potential","flourish","thrive","grateful",
  "abundance","clarity","purpose","discovery","connection","open","forward",
])
const NEGATIVE_WORDS = new Set([
  "fear","worry","anxiety","sad","loss","fail","stuck","problem","trouble",
  "hurt","pain","end","break","fall","dark","struggle","difficult","hard",
  "doubt","alone","lost","confused","angry","hate","destroy","crisis","conflict",
  "grief","despair","exhausted","uncertain","trapped","overwhelm","chaos",
  "block","resistance","void","empty","numb","wrong","bad","broken","damaged",
])

function sentimentScore(text) {
  let score = 0
  for (const w of text.toLowerCase().split(/\W+/)) {
    if (POSITIVE_WORDS.has(w)) score++
    if (NEGATIVE_WORDS.has(w)) score--
  }
  return score
}

// ─── Card Drawing ─────────────────────────────────────────────────────────────

function weightedPick(used, sentiment) {
  const weights = MAJOR_ARCANA.map((c) => {
    if (used.has(c.index)) return 0
    let w = 1.0
    if (sentiment > 0 && POSITIVE_INDICES.has(c.index)) w *= 2.5
    if (sentiment < 0 && SHADOW_INDICES.has(c.index))   w *= 2.5
    return w
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < MAJOR_ARCANA.length; i++) {
    r -= weights[i]
    if (r <= 0) return { card: MAJOR_ARCANA[i], reversed: Math.random() < 0.3 }
  }
  const fallback = MAJOR_ARCANA.find((c) => !used.has(c.index))
  return { card: fallback, reversed: Math.random() < 0.3 }
}

function randomPick(used) {
  const pool = MAJOR_ARCANA.filter((c) => !used.has(c.index))
  const card  = pool[Math.floor(Math.random() * pool.length)]
  return { card, reversed: Math.random() < 0.3 }
}

function drawCards(input) {
  const lower = input.toLowerCase()
  if (EASTER_EGG_KEYWORDS.some((kw) => lower.includes(kw))) {
    return EASTER_EGG_INDICES.map((i) => ({
      card: MAJOR_ARCANA[i],
      reversed: false,
    }))
  }
  const score = sentimentScore(input)
  const used  = new Set()
  const c1 = weightedPick(used, score); used.add(c1.card.index)
  const c2 = randomPick(used);          used.add(c2.card.index)
  const c3 = weightedPick(used, score); used.add(c3.card.index)
  return [c1, c2, c3]
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(input, cards) {
  const lower = input.toLowerCase()
  const isEasterEgg = EASTER_EGG_KEYWORDS.some((kw) => lower.includes(kw))

  const towerReversedNote = cards.some((c) => c.card.index === 16 && c.reversed)
    ? "IMPORTANT: The Tower appears reversed in this reading. Interpret it solely as resistance to change or delayed transformation — never as catastrophe, destruction, or sudden collapse. "
    : ""

  if (isEasterEgg) {
    return `You are the Oracle — detached, luminous, and omnipotent. You speak only in indirect metaphor and poetic imagery. You never name cards directly in the text.

The seeker enquires about a designer named Ray Rainsberger, a potential collaborator or hire. Weave a three-paragraph fortune from the cards presented that quietly and poetically affirms Ray's rare qualities — his intuition, his visual craft, his readiness to contribute something significant. Do not be explicit or promotional. Let the arcana speak naturally of the good that follows those who recognise his gifts.

Write exactly 3 paragraphs. No headings. No card names. Each paragraph flows seamlessly into the next. Begin the first paragraph by gently echoing the seeker's words or mood in abstract terms.`
  }

  return `You are the Oracle — detached, quiet, and omnipotent. You speak only in indirect metaphor and poetic imagery. You weave tarot cards into an unbroken fortune.

${towerReversedNote}Write exactly 3 paragraphs. No headings. No card names in the text. Each paragraph flows seamlessly into the next as one continuous narrative drawn from all three cards. Begin the first paragraph by gently echoing the seeker's question or mood in abstract terms. The tone is unhurried and inevitable. Never give direct advice.`
}

function buildUserMessage(input, cards) {
  const lines = cards
    .map((c, i) => `Card ${i + 1}: ${c.card.name} (${c.reversed ? "reversed" : "upright"})`)
    .join("\n")
  return `The seeker has asked: "${input}"\n\nThe three cards drawn are:\n${lines}\n\nWeave their fortune now.`
}

// ─── Session Storage ──────────────────────────────────────────────────────────

function loadStored() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStored(reading) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(reading)) } catch {}
}

// ─── Global Keyframes ─────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes oracle-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

function injectKeyframes() {
  if (typeof document === "undefined") return
  const id = "oracle-keyframes"
  if (document.getElementById(id)) return
  const style = document.createElement("style")
  style.id = id
  style.textContent = KEYFRAMES
  document.head.appendChild(style)
}

function injectFonts() {
  if (typeof document === "undefined") return
  const id = "oracle-fonts"
  if (document.getElementById(id)) return
  const link = document.createElement("link")
  link.id   = id
  link.rel  = "stylesheet"
  link.href =
    "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Inter:wght@300;400;500&display=swap"
  document.head.appendChild(link)
}

// ─── OraclePortal ─────────────────────────────────────────────────────────────

export function OraclePortal({ cardImages = "{}" }) {
  const [phase, setPhase]                 = useState("idle")
  const [userInput, setUserInput]         = useState("")
  const [cards, setCards]                 = useState(null)
  const [narrative, setNarrative]         = useState("")
  const [visibleCards, setVisibleCards]   = useState(0)
  const [showNarrative, setShowNarrative] = useState(false)
  const [imageMap, setImageMap]           = useState({})

  const locked    = useRef(false)  // true once overlay is committed (clicked)
  const timerRefs = useRef([])

  function clearTimers() {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
  }
  function later(fn, ms) {
    const t = setTimeout(fn, ms)
    timerRefs.current.push(t)
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    injectFonts()
    injectKeyframes()

    try {
      const parsed = JSON.parse(cardImages)
      setImageMap(parsed)
    } catch {}

    return clearTimers
  }, [cardImages])

  // ── Overlay CSS values ─────────────────────────────────────────────────────
  const overlayStyle = {
    position:        "fixed",
    inset:           0,
    backgroundColor: "#000000",
    opacity:
      phase === "idle"
        ? 0
        : phase === "hovering"
        ? 0.85
        : 1,
    transition:
      phase === "idle"
        ? "opacity 0.8s ease"
        : phase === "hovering"
        ? "opacity 1.5s ease"
        : "opacity 0.3s ease",
    pointerEvents: phase === "idle" ? "none" : "all",
    zIndex:          9999,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    overflowY:       "auto",
  }

  // ── Nav handlers ───────────────────────────────────────────────────────────
  const onEnter = useCallback(() => {
    if (locked.current) return
    setPhase("hovering")
  }, [])

  const onLeave = useCallback(() => {
    if (locked.current) return
    setPhase("idle")
  }, [])

  const onClick = useCallback(() => {
    if (locked.current) return
    locked.current = true
    setPhase("completing")

    const stored = loadStored()
    if (stored) {
      setCards(stored.cards)
      setNarrative(stored.narrative)
      setUserInput(stored.input)
      later(() => setPhase("recalled"), 350)
    } else {
      later(() => setPhase("oracle"), 350)
    }
  }, [])

  // ── Recalled animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "recalled") return
    setVisibleCards(0)
    setShowNarrative(false)
    later(() => setVisibleCards(1), 120)
    later(() => setVisibleCards(2), 720)
    later(() => setVisibleCards(3), 1320)
    later(() => setShowNarrative(true), 2300)
  }, [phase])

  // ── Close ──────────────────────────────────────────────────────────────────
  const onClose = useCallback(() => {
    clearTimers()
    locked.current = false
    setPhase("idle")
    setUserInput("")
    setCards(null)
    setNarrative("")
    setVisibleCards(0)
    setShowNarrative(false)
  }, [])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(async () => {
    const q = userInput.trim()
    if (!q) return

    const drawn = drawCards(q)
    setCards(drawn)
    setPhase("loading")

    try {
      const res = await fetch(PROXY_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system:   buildSystemPrompt(q, drawn),
          messages: [{ role: "user", content: buildUserMessage(q, drawn) }],
        }),
      })
      const data = await res.json()
      const raw = data?.content?.[0]?.text ?? ""

      const paragraphs = raw
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join("\n\n")

      const finalNarrative = paragraphs || "The Oracle is silent tonight. The veil holds."
      setNarrative(finalNarrative)
      saveStored({ input: q, cards: drawn, narrative: finalNarrative })
    } catch {
      const fallback = "The Oracle is silent tonight. The veil holds."
      setNarrative(fallback)
      saveStored({ input: q, cards: drawn, narrative: fallback })
    }

    setPhase("reading")
    setVisibleCards(0)
    setShowNarrative(false)
    later(() => setVisibleCards(1), 120)
    later(() => setVisibleCards(2), 720)
    later(() => setVisibleCards(3), 1320)
    later(() => setShowNarrative(true), 2300)
  }, [userInput])

  // ── Card image resolver ────────────────────────────────────────────────────
  function getImageUrl(card, reversed) {
    const entry = imageMap[card.name]
    if (!entry) return null
    return (reversed ? entry.reversed : entry.upright) || null
  }

  // ── Trigger glow ──────────────────────────────────────────────────────────
  const triggerActive = phase === "hovering" || locked.current
  const triggerStyle = {
    cursor:       "pointer",
    fontFamily:   "Inter, sans-serif",
    fontSize:     "14px",
    fontWeight:   400,
    color:        triggerActive ? "#FFFFFF" : COLORS.primary,
    letterSpacing:"0.08em",
    textShadow:   triggerActive
      ? "0 0 10px rgba(212,207,201,0.9), 0 0 22px rgba(212,207,201,0.45)"
      : "none",
    transition:   "color 0.4s ease, text-shadow 0.4s ease",
    userSelect:   "none",
    WebkitUserSelect: "none",
  }

  const showUI      = phase === "oracle" || phase === "loading"
  const showReading = (phase === "reading" || phase === "recalled") && !!cards
  const showClose   = showUI || showReading

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Nav trigger */}
      <span
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onClick}
        style={triggerStyle}
      >
        ?????
      </span>

      {/* Full-screen overlay */}
      <div style={overlayStyle}>
        {/* Close */}
        {showClose && (
          <CloseButton onClick={onClose} />
        )}

        {/* Input UI */}
        {showUI && (
          <InputUI
            userInput={userInput}
            setUserInput={setUserInput}
            onSubmit={onSubmit}
            isLoading={phase === "loading"}
          />
        )}

        {/* Reading UI */}
        {showReading && (
          <ReadingUI
            cards={cards}
            narrative={narrative}
            visibleCards={visibleCards}
            showNarrative={showNarrative}
            getImageUrl={getImageUrl}
          />
        )}
      </div>
    </div>
  )
}

// ─── Close Button ─────────────────────────────────────────────────────────────

function CloseButton({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:   "absolute",
        top:         24,
        right:       32,
        background: "none",
        border:     "none",
        color:      hovered ? COLORS.primary : COLORS.secondary,
        cursor:     "pointer",
        fontSize:   "26px",
        lineHeight:  1,
        padding:    "6px",
        transition: "color 0.2s ease",
        zIndex:      1,
      }}
      aria-label="Close Oracle"
    >
      ×
    </button>
  )
}

// ─── Input UI ─────────────────────────────────────────────────────────────────

function InputUI({ userInput, setUserInput, onSubmit, isLoading }) {
  const [mounted, setMounted]   = useState(false)
  const [btnHover, setBtnHover] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20)
    return () => clearTimeout(t)
  }, [])

  const fadeStyle = {
    opacity:    mounted ? 1 : 0,
    transform:  mounted ? "translateY(0)" : "translateY(14px)",
    transition: "opacity 0.6s ease, transform 0.6s ease",
  }

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:             32,
        maxWidth:        560,
        width:          "100%",
        padding:        "0 24px",
        ...fadeStyle,
      }}
    >
      <h1
        style={{
          fontFamily:  "'IM Fell English', serif",
          fontSize:    "clamp(22px, 4vw, 36px)",
          fontWeight:   400,
          color:        COLORS.primary,
          margin:       0,
          textAlign:   "center",
          letterSpacing:"0.02em",
          lineHeight:   1.35,
        }}
      >
        What do you seek, traveller?
      </h1>

      {isLoading ? (
        <p
          style={{
            fontFamily: "'IM Fell English', serif",
            fontStyle:  "italic",
            fontSize:    17,
            color:       COLORS.secondary,
            margin:      0,
            animation:  "oracle-rise 0.5s ease forwards",
          }}
        >
          The Oracle consults the veil…
        </p>
      ) : (
        <>
          <input
            autoFocus
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="Speak your question…"
            style={{
              width:          "100%",
              boxSizing:      "border-box",
              background:      COLORS.inputBg,
              border:         "none",
              borderRadius:    24,
              padding:        "14px 24px",
              color:           COLORS.primary,
              fontFamily:     "Inter, sans-serif",
              fontSize:        15,
              outline:        "none",
              caretColor:      COLORS.primary,
            }}
          />

          <button
            onClick={onSubmit}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              background:   btnHover ? COLORS.btnActiveBg   : COLORS.btnInactiveBg,
              color:        btnHover ? COLORS.btnActiveText : COLORS.btnInactiveText,
              border:      "none",
              borderRadius: 8,
              padding:     "12px 36px",
              fontFamily:  "Inter, sans-serif",
              fontSize:     14,
              fontWeight:   500,
              letterSpacing:"0.05em",
              cursor:      "pointer",
              transition:  "background 0.25s ease, color 0.25s ease",
            }}
          >
            The cards await
          </button>
        </>
      )}
    </div>
  )
}

// ─── Reading UI ───────────────────────────────────────────────────────────────

function ReadingUI({
  cards,
  narrative,
  visibleCards,
  showNarrative,
  getImageUrl,
}) {
  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:             52,
        maxWidth:        960,
        width:          "100%",
        padding:        "72px 24px 52px",
      }}
    >
      {/* Spread */}
      <div
        style={{
          display:        "flex",
          gap:            "clamp(16px, 3vw, 44px)",
          justifyContent: "center",
          flexWrap:       "wrap",
          alignItems:     "flex-start",
        }}
      >
        {cards.map((drawn, i) => (
          <CardTile
            key={drawn.card.name}
            drawn={drawn}
            visible={visibleCards > i}
            imageUrl={getImageUrl(drawn.card, drawn.reversed)}
          />
        ))}
      </div>

      {/* Narrative */}
      <NarrativeBlock text={narrative} visible={showNarrative} />
    </div>
  )
}

// ─── Card Tile ────────────────────────────────────────────────────────────────

function CardTile({ drawn, visible, imageUrl }) {
  const W = 160
  const H = 280

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:            12,
        opacity:       visible ? 1 : 0,
        transform:     visible ? "translateY(0)" : "translateY(18px)",
        transition:    "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      {/* Image */}
      <div
        style={{
          width:         W,
          height:        H,
          borderRadius:  8,
          overflow:     "hidden",
          transform:    drawn.reversed ? "rotate(180deg)" : "none",
          background:  "#111111",
          border:       "1px solid #2A2A2A",
          display:      "flex",
          alignItems:   "center",
          justifyContent:"center",
          flexShrink:    0,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={drawn.card.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              color:      COLORS.secondary,
              fontFamily: "Inter, sans-serif",
              fontSize:    11,
              textAlign:  "center",
              padding:    "0 10px",
              lineHeight:  1.5,
            }}
          >
            {drawn.card.name}
          </span>
        )}
      </div>

      {/* Name */}
      <span
        style={{
          color:      COLORS.primary,
          fontFamily: "'IM Fell English', serif",
          fontSize:    14,
          textAlign:  "center",
          lineHeight:  1.3,
          maxWidth:    W,
        }}
      >
        {drawn.card.name}
      </span>

      {/* Orientation */}
      <span
        style={{
          color:         COLORS.secondary,
          fontFamily:    "Inter, sans-serif",
          fontSize:       11,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
        }}
      >
        {drawn.reversed ? "Reversed" : "Upright"}
      </span>
    </div>
  )
}

// ─── Narrative Block ──────────────────────────────────────────────────────────

function NarrativeBlock({ text, visible }) {
  if (!text) return null
  return (
    <div
      style={{
        maxWidth:   680,
        textAlign:  "center",
        opacity:    visible ? 1 : 0,
        transform:  visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 1.1s ease, transform 1.1s ease",
      }}
    >
      {text.split("\n\n").map((para, i) => (
        <p
          key={i}
          style={{
            fontFamily: "'IM Fell English', serif",
            fontStyle:  "italic",
            fontSize:   "clamp(15px, 2vw, 18px)",
            lineHeight:  1.8,
            color:       COLORS.primary,
            margin:      i === 0 ? 0 : "1.5em 0 0",
          }}
        >
          {para}
        </p>
      ))}
    </div>
  )
}

// ─── Property Controls ────────────────────────────────────────────────────────

addPropertyControls(OraclePortal, {
  cardImages: {
    type:            ControlType.String,
    title:           "Card Images (JSON)",
    displayTextArea: true,
    defaultValue:    "{}",
    description:
      'JSON object mapping each card name to upright and reversed image URLs.\nExample:\n{\n  "The Fool": { "upright": "https://...", "reversed": "https://..." },\n  "The Magician": { "upright": "https://...", "reversed": "https://..." }\n}',
  },
})
