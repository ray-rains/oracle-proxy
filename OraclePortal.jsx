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
import ReactDOM from "react-dom"
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

const SESSION_KEY        = "oracle_reading"
const SESSION_REROLL_KEY = "oracle_reroll"
const PROXY_URL   =   "https://oracle-proxy.vercel.app/api/reading"

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

function loadStoredReroll() {
  try {
    const raw = sessionStorage.getItem(SESSION_REROLL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStoredReroll(reading) {
  try { sessionStorage.setItem(SESSION_REROLL_KEY, JSON.stringify(reading)) } catch {}
}

// ─── Global Keyframes ─────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes oracle-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes oracle-scatter-left {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-40px); }
}
@keyframes oracle-scatter-right {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(40px); }
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

function useBodyPortal() {
  const [el, setEl] = useState(null)
  useEffect(() => {
    if (typeof document === "undefined") return
    const div = document.createElement("div")
    div.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "bottom:0",
      "z-index:99999",
      "pointer-events:none",
      "visibility:hidden",
    ].join(";")
    div.id = "oracle-portal"
    document.body.appendChild(div)
    setEl(div)
    return () => {
      if (document.body.contains(div)) document.body.removeChild(div)
    }
  }, [])
  return el
}

// ─── OraclePortal ─────────────────────────────────────────────────────────────

export function OraclePortal({ cardImages = "{}", oracleImage = "" }) {
  const [phase, setPhase]                 = useState("idle")
  const [userInput, setUserInput]         = useState("")
  const [cards, setCards]                 = useState(null)
  const [narrative, setNarrative]         = useState("")
  const [visibleCards, setVisibleCards]   = useState(0)
  const [showNarrative, setShowNarrative] = useState(false)
  const [imageMap, setImageMap]           = useState({})

  const [hasBeenOpened,       setHasBeenOpened]       = useState(false)

  const [hasRerolled,         setHasRerolled]         = useState(false)
  const [rerollCards,         setRerollCards]         = useState(null)
  const [rerollNarrative,     setRerollNarrative]     = useState("")
  const [rerollVisibleCards,  setRerollVisibleCards]  = useState(0)
  const [showRerollNarrative, setShowRerollNarrative] = useState(false)
  const [rerollInput,         setRerollInput]         = useState("")
  const [showRerollInput,     setShowRerollInput]     = useState(false)
  const [rerollLoading,       setRerollLoading]       = useState(false)
  const [scattering,          setScattering]          = useState(false)

  const locked      = useRef(false)  // true once overlay is committed (clicked)
  const timerRefs   = useRef([])
  const triggerRef  = useRef(null)

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

    function onMouseMove(e) {
      const el = triggerRef.current
      if (!el) return
      const { top, bottom, left, right } = el.getBoundingClientRect()
      const over =
        e.clientX >= left && e.clientX <= right &&
        e.clientY >= top  && e.clientY <= bottom
      if (over) {
        if (!locked.current) setPhase((p) => p === "idle" ? "hovering" : p)
      } else {
        if (!locked.current) setPhase((p) => p === "hovering" ? "idle" : p)
      }
    }

    document.addEventListener("mousemove", onMouseMove)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      clearTimers()
    }
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
    pointerEvents:   "all",
    zIndex:          9999,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    overflowY:       "hidden",
  }

  // ── Nav handlers ───────────────────────────────────────────────────────────
  const onClick = useCallback(() => {
    setHasBeenOpened(true)
    if (locked.current) return
    locked.current = true
    setPhase("completing")

    const stored = loadStored()
    if (stored) {
      setCards(stored.cards)
      setNarrative(stored.narrative)
      setUserInput(stored.input)

      const storedReroll = loadStoredReroll()
      if (storedReroll) {
        setRerollCards(storedReroll.cards)
        setRerollNarrative(storedReroll.narrative)
        setRerollInput(storedReroll.input)
        setHasRerolled(true)
        setRerollVisibleCards(3)
        setShowRerollNarrative(true)
      }

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
    setHasRerolled(false)
    setRerollCards(null)
    setRerollNarrative("")
    setRerollVisibleCards(0)
    setShowRerollNarrative(false)
    setRerollInput("")
    setShowRerollInput(false)
    setRerollLoading(false)
    setScattering(false)
  }, [])

  // ── Reroll ─────────────────────────────────────────────────────────────────
  const onRerollClick = useCallback(() => {
    setScattering(true)
    setTimeout(() => {
      setScattering(false)
      setShowRerollInput(true)
    }, 600)
  }, [])

  const onRerollSubmit = useCallback(async () => {
    const q = rerollInput.trim()
    if (!q) return

    setRerollLoading(true)
    const drawn = drawCards(q)

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
      setRerollCards(drawn)
      setRerollNarrative(finalNarrative)
      saveStoredReroll({ input: q, cards: drawn, narrative: finalNarrative })
    } catch {
      const fallback = "The Oracle is silent tonight. The veil holds."
      setRerollCards(drawn)
      setRerollNarrative(fallback)
      saveStoredReroll({ input: q, cards: drawn, narrative: fallback })
    }

    setRerollLoading(false)
    setHasRerolled(true)
    setScattering(false)
    setRerollVisibleCards(0)
    setShowRerollNarrative(false)
    later(() => setShowRerollInput(false), 400)
    later(() => setRerollVisibleCards(1), 520)
    later(() => setRerollVisibleCards(2), 1120)
    later(() => setRerollVisibleCards(3), 1720)
    later(() => setShowRerollNarrative(true), 2700)
  }, [rerollInput])

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
    position:     "relative",
    zIndex:        10001,
  }

  const showUI      = phase === "oracle" || phase === "loading"
  const showReading = (phase === "reading" || phase === "recalled") && !!cards
  const showClose   = showUI || showReading
  const portalEl = useBodyPortal()

  return (
    <div style={{ position: "relative", display: "inline-block", zIndex: 10000 }}>
      {/* Nav trigger */}
      <span
        ref={triggerRef}
        onClick={onClick}
        style={triggerStyle}
      >
        {hasBeenOpened ? "The Oracle" : "?????"}
      </span>

      {/* Full-screen overlay — portaled to body to escape Safari stacking context */}
      {portalEl && (() => {
        portalEl.style.pointerEvents = phase === "idle" ? "none" : "all"
        portalEl.style.visibility    = phase === "idle" ? "hidden" : "visible"
        return ReactDOM.createPortal(
          <div style={overlayStyle}>
            {showClose && <CloseButton onClick={onClose} />}
            {showUI && (
              <InputUI
                userInput={userInput}
                setUserInput={setUserInput}
                onSubmit={onSubmit}
                isLoading={phase === "loading"}
                oracleImage={oracleImage}
              />
            )}
            {showReading && (
              <ReadingUI
                cards={cards}
                narrative={narrative}
                visibleCards={visibleCards}
                showNarrative={showNarrative}
                getImageUrl={getImageUrl}
                onRerollClick={onRerollClick}
                hasRerolled={hasRerolled}
                rerollCards={rerollCards}
                rerollNarrative={rerollNarrative}
                rerollVisibleCards={rerollVisibleCards}
                showRerollNarrative={showRerollNarrative}
                rerollInput={rerollInput}
                setRerollInput={setRerollInput}
                onRerollSubmit={onRerollSubmit}
                showRerollInput={showRerollInput}
                rerollLoading={rerollLoading}
                scattering={scattering}
              />
            )}
          </div>,
          portalEl
        )
      })()}
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
        position:      "absolute",
        top:            16,
        left:          "50%",
        transform:     "translateX(-50%)",
        background:    "none",
        border:        "none",
        color:         hovered ? COLORS.primary : COLORS.secondary,
        cursor:        "pointer",
        fontFamily:    "Inter, sans-serif",
        fontSize:       13,
        fontWeight:     400,
        letterSpacing: "0.08em",
        padding:       "6px 12px",
        transition:    "color 0.2s ease",
        zIndex:         1,
        whiteSpace:    "nowrap",
      }}
      aria-label="Close Oracle"
    >
      Turn back
    </button>
  )
}

// ─── Input UI ─────────────────────────────────────────────────────────────────

function InputUI({ userInput, setUserInput, onSubmit, isLoading, oracleImage = "" }) {
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
        gap:             0,
        height:         "100vh",
        justifyContent: "space-between",
        width:          "100%",
        maxWidth:        560,
        ...fadeStyle,
      }}
    >
      <div style={{ height: 24 }} />

      {/* Oracle illustration */}
      <div style={{
        position:   "relative",
        flexGrow:    1,
        width:      "100%",
        maxWidth:    560,
        overflow:   "hidden",
        opacity:     mounted ? 1 : 0,
        transition: "opacity 500ms ease-out",
      }}>
        {oracleImage ? (
          <img
            src={oracleImage}
            alt="The Oracle"
            style={{
              width:      "100%",
              height:     "100%",
              objectFit:  "cover",
              display:    "block",
            }}
          />
        ) : null}
        <div style={{
          position:   "absolute",
          bottom:      0,
          left:        0,
          right:       0,
          height:     "80%",
          background: "linear-gradient(to top, #000000 0%, rgba(0,0,0,0) 100%)",
          pointerEvents: "none",
        }} />
      </div>

      {/* Input section */}
      <div style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:            32,
        width:         "100%",
        padding:       "0 24px 48px",
      }}>
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
  onRerollClick,
  hasRerolled,
  rerollCards,
  rerollNarrative,
  rerollVisibleCards,
  showRerollNarrative,
  rerollInput,
  setRerollInput,
  onRerollSubmit,
  showRerollInput,
  rerollLoading,
  scattering,
}) {
  const NEW_W = 120
  const OLD_W = Math.round(NEW_W * 0.7)
  const PEEK  = 16
  return (
    <div style={{
      position:      "fixed",
      inset:          0,
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      overflow:      "hidden",
    }}>
      {/* ── ZONE 1: CARD ROW — fixed height, never grows ── */}
      <div style={{
        flexShrink:     0,
        width:          "100%",
        maxWidth:        960,
        padding:        "48px 24px 0",
        display:        "flex",
        justifyContent: "center",
        gap:             24,
      }}>
        {cards.map((drawn, i) => {
          const isOld    = !!rerollCards
          const cardSize = isOld ? OLD_W : NEW_W
          return (
            <div key={"card-" + i} style={{ position: "relative", width: NEW_W }}>
              {/* Old card — peeks above new card when reroll active */}
              <div style={{
                position:   "absolute",
                top:         isOld ? -PEEK : 0,
                left:        isOld ? (NEW_W - OLD_W) / 2 : 0,
                opacity:     visibleCards > i ? (isOld ? 0.5 : 1) : 0,
                transition:  "opacity 0.6s ease, top 0.6s ease",
                zIndex:      2,
              }}>
                <CardImage
                  drawn={drawn}
                  imageUrl={getImageUrl(drawn.card, drawn.reversed)}
                  size={cardSize}
                  showLabels={!isOld}
                />
              </div>
              {/* New card — renders in flow, defines column height */}
              {rerollCards && rerollCards[i] && (
                <div style={{
                  opacity:    rerollVisibleCards > i ? 1 : 0,
                  transform:  rerollVisibleCards > i ? "translateY(0)" : "translateY(18px)",
                  transition: "opacity 0.65s ease, transform 0.65s ease",
                  zIndex:     1,
                }}>
                  <CardImage
                    drawn={rerollCards[i]}
                    imageUrl={getImageUrl(rerollCards[i].card, rerollCards[i].reversed)}
                    size={NEW_W}
                    showLabels={true}
                  />
                </div>
              )}
              {/* Spacer to hold column height when no reroll cards yet */}
              {!rerollCards && (
                <CardImage
                  drawn={drawn}
                  imageUrl={getImageUrl(drawn.card, drawn.reversed)}
                  size={NEW_W}
                  showLabels={true}
                />
              )}
            </div>
          )
        })}
      </div>
      {/* ── SEPARATOR ── */}
      <div style={{
        flexShrink: 0,
        width:      "100%",
        height:      1,
        background: "#2A2A2A",
        marginTop:   16,
      }} />
      {/* ── ZONE 2: NARRATIVE SCROLL BOX — fills remaining space above button ── */}
      <div style={{
        flex:       1,
        width:      "100%",
        maxWidth:    960,
        overflowY:  "auto",
        padding:    "0 24px",
        position:   "relative",
        minHeight:   0,
      }}>
        <NarrativeBlock
          key={showRerollNarrative && rerollNarrative ? "reroll" : "original"}
          text={showRerollNarrative && rerollNarrative ? rerollNarrative : narrative}
          visible={showNarrative || showRerollNarrative}
        />
        {/* Fade gradient */}
        <div style={{
          position:      "sticky",
          bottom:         0,
          left:           0,
          right:          0,
          height:         48,
          background:    "linear-gradient(to bottom, rgba(0,0,0,0), #000000)",
          pointerEvents: "none",
          zIndex:         1,
        }} />
      </div>
      {/* ── ZONE 3: BUTTON ROW — fixed height, always visible ── */}
      <div style={{
        flexShrink:     0,
        height:          72,
        width:          "100%",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
      }}>
        {showNarrative && !hasRerolled && !rerollCards && (
          <div style={{
            opacity:    scattering ? 0 : 1,
            transition: "opacity 0.4s ease",
          }}>
            <RerollButton onClick={onRerollClick} />
          </div>
        )}
      </div>
      {/* ── REROLL INPUT MODAL ── */}
      {showRerollInput && (
        <div style={{
          position:        "fixed",
          inset:            0,
          backgroundColor: "rgba(0,0,0,0.92)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          zIndex:           20,
        }}>
          <RerollInputUI
            value={rerollInput}
            onChange={setRerollInput}
            onSubmit={onRerollSubmit}
            isLoading={rerollLoading}
          />
        </div>
      )}
    </div>
  )
}

// ─── Card Image ───────────────────────────────────────────────────────────────

function CardImage({ drawn, imageUrl, size, showLabels }) {
  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      gap:            6,
    }}>
      <div style={{
        width:          size,
        height:         size,
        borderRadius:   8,
        overflow:      "hidden",
        transform:     drawn.reversed ? "rotate(180deg)" : "none",
        background:   "#111111",
        border:        "1px solid #2A2A2A",
        flexShrink:    0,
      }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={drawn.card.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{
            color:      COLORS.secondary,
            fontFamily: "Inter, sans-serif",
            fontSize:    10,
            textAlign:  "center",
            padding:    "0 6px",
            lineHeight:  1.4,
            display:    "flex",
            alignItems: "center",
            justifyContent: "center",
            height:     "100%",
          }}>
            {drawn.card.name}
          </span>
        )}
      </div>
      {showLabels && (
        <>
          <span style={{
            color:      COLORS.primary,
            fontFamily: "'IM Fell English', serif",
            fontSize:    12,
            textAlign:  "center",
            lineHeight:  1.3,
            maxWidth:    size,
          }}>
            {drawn.card.name}
          </span>
          <span style={{
            color:         COLORS.secondary,
            fontFamily:    "Inter, sans-serif",
            fontSize:       10,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          }}>
            {drawn.reversed ? "Reversed" : "Upright"}
          </span>
        </>
      )}
    </div>
  )
}

// ─── Card Tile ────────────────────────────────────────────────────────────────

function CardTile({ drawn, visible, imageUrl, dimmed = false }) {
  const size = 120
  return (
    <div style={{
      opacity:    visible ? (dimmed ? 0.5 : 1) : 0,
      transform:  visible ? "translateY(0)" : "translateY(18px)",
      transition: "opacity 0.65s ease, transform 0.65s ease",
    }}>
      <CardImage
        drawn={drawn}
        imageUrl={imageUrl}
        size={size}
        showLabels={!dimmed}
      />
    </div>
  )
}

// ─── Narrative Block ──────────────────────────────────────────────────────────

function NarrativeBlock({ text, visible }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20)
    return () => clearTimeout(t)
  }, [])
  if (!text) return null
  return (
    <div style={{
      maxWidth:      680,
      margin:        "0 auto",
      padding:       "24px 0 0",
      opacity:       visible && mounted ? 1 : 0,
      transform:     visible && mounted ? "translateY(0)" : "translateY(14px)",
      transition:    "opacity 0.8s ease, transform 0.8s ease",
      pointerEvents: visible ? "all" : "none",
    }}>
      {text.split("\n\n").map((para, i) => (
        <p key={i} style={{
          fontFamily: "Inter, sans-serif",
          fontStyle:  "normal",
          fontWeight:  400,
          fontSize:   "9pt",
          lineHeight:  1.5,
          color:      "#EAEAEA",
          textAlign:  "left",
          margin:      i === 0 ? 0 : "1.5em 0 0",
        }}>
          {para}
        </p>
      ))}
    </div>
  )
}

// ─── Reroll Button ────────────────────────────────────────────────────────────

function RerollButton({ onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:    hover ? COLORS.btnActiveBg   : COLORS.btnInactiveBg,
        color:         hover ? COLORS.btnActiveText : COLORS.btnInactiveText,
        border:        "none",
        borderRadius:   8,
        padding:       "12px 36px",
        fontFamily:    "Inter, sans-serif",
        fontSize:       14,
        fontWeight:     500,
        letterSpacing: "0.05em",
        cursor:        "pointer",
        transition:    "background 0.25s ease, color 0.25s ease",
        whiteSpace:    "nowrap",
      }}
    >
      I choose my own fate
    </button>
  )
}

// ─── Reroll Input UI ──────────────────────────────────────────────────────────

function RerollInputUI({ value, onChange, onSubmit, isLoading }) {
  const [btnHover, setBtnHover] = useState(false)
  const [mounted, setMounted]   = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      gap:            24,
      maxWidth:       480,
      width:         "100%",
      padding:       "0 24px",
      opacity:        mounted ? 1 : 0,
      transform:      mounted ? "translateY(0)" : "translateY(14px)",
      transition:    "opacity 0.6s ease, transform 0.6s ease",
    }}>
      <p style={{
        fontFamily: "'IM Fell English', serif",
        fontStyle:  "italic",
        fontSize:    20,
        color:       COLORS.primary,
        margin:      0,
        textAlign:  "center",
        lineHeight:  1.4,
      }}>
        The cards remember. What else do you seek?
      </p>
      {isLoading ? (
        <p style={{
          fontFamily: "'IM Fell English', serif",
          fontStyle:  "italic",
          fontSize:    16,
          color:       COLORS.secondary,
          margin:      0,
        }}>
          The Oracle consults the veil…
        </p>
      ) : (
        <>
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="Speak your question…"
            style={{
              width:        "100%",
              boxSizing:    "border-box",
              background:    COLORS.inputBg,
              border:       "none",
              borderRadius:  24,
              padding:      "14px 24px",
              color:         COLORS.primary,
              fontFamily:   "Inter, sans-serif",
              fontSize:      15,
              outline:      "none",
              caretColor:    COLORS.primary,
            }}
          />
          <button
            onClick={onSubmit}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              background:    btnHover ? COLORS.btnActiveBg   : COLORS.btnInactiveBg,
              color:         btnHover ? COLORS.btnActiveText : COLORS.btnInactiveText,
              border:        "none",
              borderRadius:   8,
              padding:       "12px 36px",
              fontFamily:    "Inter, sans-serif",
              fontSize:       14,
              fontWeight:     500,
              letterSpacing: "0.05em",
              cursor:        "pointer",
              transition:    "background 0.25s ease, color 0.25s ease",
            }}
          >
            The cards await
          </button>
        </>
      )}
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
  oracleImage: {
    type:  ControlType.Image,
    title: "Oracle Illustration",
  },
})
