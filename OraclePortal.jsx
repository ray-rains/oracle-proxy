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
  const locked    = useRef(false)
  const timerRefs = useRef([])
  const triggerRef = useRef(null)
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
  // ── Dispatch state to OracleOverlay ───────────────────────────────────────
  useEffect(() => {
    const payload = {
      phase,
      userInput,
      cards,
      narrative,
      visibleCards,
      showNarrative,
      hasBeenOpened,
      hasRerolled,
      rerollCards,
      rerollNarrative,
      rerollVisibleCards,
      showRerollNarrative,
      showRerollInput,
      rerollLoading,
      scattering,
      imageMap,
      oracleImage,
    }
    try {
      window.parent.postMessage({ type: "oracle:state", detail: payload }, "*")
    } catch {}
    window.postMessage({ type: "oracle:state", detail: payload }, "*")
  }, [
    phase, userInput, cards, narrative, visibleCards, showNarrative,
    hasBeenOpened, hasRerolled, rerollCards, rerollNarrative,
    rerollVisibleCards, showRerollNarrative, showRerollInput,
    rerollLoading, scattering, imageMap, oracleImage,
  ])
  // ── Listen for actions from OracleOverlay ─────────────────────────────────
  useEffect(() => {
    function onAction(e) {
      if (!e.data || e.data.type !== "oracle:action") return
      const { action, value } = e.data
      if (action === "close")             onClose()
      if (action === "submit")            onSubmitWithValue(value)
      if (action === "inputChange")       setUserInput(value)
      if (action === "reroll")            onRerollClick()
      if (action === "rerollInputChange") setRerollInput(value)
      if (action === "rerollSubmit")      onRerollSubmitWithValue(value)
    }
    window.addEventListener("message", onAction)
    return () => window.removeEventListener("message", onAction)
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
  // ── Nav click ──────────────────────────────────────────────────────────────
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
  // ── Reroll click ───────────────────────────────────────────────────────────
  const onRerollClick = useCallback(() => {
    setScattering(true)
    setTimeout(() => {
      setScattering(false)
      setShowRerollInput(true)
    }, 600)
  }, [])
  // ── Submit ─────────────────────────────────────────────────────────────────
  async function onSubmitWithValue(q) {
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
      const raw  = data?.content?.[0]?.text ?? ""
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
  }
  // ── Reroll submit ──────────────────────────────────────────────────────────
  async function onRerollSubmitWithValue(q) {
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
      const raw  = data?.content?.[0]?.text ?? ""
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
  }
  // ── Image resolver ─────────────────────────────────────────────────────────
  function getImageUrl(card, reversed) {
    const entry = imageMap[card.name]
    if (!entry) return null
    return (reversed ? entry.reversed : entry.upright) || null
  }
  // ── Trigger ────────────────────────────────────────────────────────────────
  const triggerActive = phase === "hovering" || locked.current
  const triggerStyle = {
    cursor:        "pointer",
    fontFamily:    "Inter, sans-serif",
    fontSize:      "14px",
    fontWeight:     400,
    color:          triggerActive ? "#FFFFFF" : COLORS.primary,
    letterSpacing: "0.08em",
    textShadow:     triggerActive
      ? "0 0 10px rgba(212,207,201,0.9), 0 0 22px rgba(212,207,201,0.45)"
      : "none",
    transition:    "color 0.4s ease, text-shadow 0.4s ease",
    userSelect:    "none",
    WebkitUserSelect: "none",
    position:      "relative",
    zIndex:         10001,
  }
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <span
        ref={triggerRef}
        onClick={onClick}
        style={triggerStyle}
      >
        {hasBeenOpened ? "The Oracle" : "?????"}
      </span>
    </div>
  )
}
addPropertyControls(OraclePortal, {
  cardImages: {
    type:            ControlType.String,
    title:           "Card Images (JSON)",
    displayTextArea: true,
    defaultValue:    "{}",
    description:
      'JSON object mapping each card name to upright and reversed image URLs.\nExample:\n{\n  "The Fool": { "upright": "https://...", "reversed": "https://..." }\n}',
  },
  oracleImage: {
    type:  ControlType.Image,
    title: "Oracle Illustration",
  },
})
