import React, { useState, useEffect, useRef } from "react"
import { addPropertyControls } from "framer"

const COLORS = {
  bg:             "#000000",
  primary:        "#D4CFC9",
  secondary:      "#7F7F7F",
  inputBg:        "#404040",
  btnInactiveBg:  "#1A1A1A",
  btnInactiveText:"#EAEAEA",
  btnActiveBg:    "#D4CFC9",
  btnActiveText:  "#1A1A1A",
}

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
  link.href = "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Inter:wght@300;400;500&display=swap"
  document.head.appendChild(link)
}

function dispatch(action, value) {
  const msg = { type: "oracle:action", action, value }
  try { window.parent.postMessage(msg, "*") } catch {}
  window.postMessage(msg, "*")
}

export function OracleOverlay() {
  const [state, setState] = useState(null)
  useEffect(() => {
    injectFonts()
    injectKeyframes()
    function onMessage(e) {
      if (!e.data || e.data.type !== "oracle:state") return
      setState(e.data.detail)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])
  const containerRef = useRef(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const container = el.closest('[class*="container"]') || el.parentElement
    if (!container) return
    container.style.pointerEvents = state && state.phase !== "idle" ? "all" : "none"
  }, [state?.phase])
  if (!state) return null
  const {
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
  } = state
  const overlayOpacity =
    phase === "idle"      ? 0 :
    phase === "hovering"  ? 0.85 : 1
  const overlayTransition =
    phase === "idle"      ? "opacity 0.8s ease" :
    phase === "hovering"  ? "opacity 1.5s ease" :
                            "opacity 0.3s ease"
  const isVisible  = phase !== "idle"
  const showUI     = phase === "oracle" || phase === "loading"
  const showReading = (phase === "reading" || phase === "recalled") && !!cards
  const showClose  = showUI || showReading
  function getImageUrl(card, reversed) {
    const entry = imageMap?.[card.name]
    if (!entry) return null
    return (reversed ? entry.reversed : entry.upright) || null
  }
  return (
    <div
      ref={containerRef}
      style={{
        position:        "fixed",
        top:              0,
        left:             0,
        right:            0,
        bottom:           0,
        backgroundColor: "#000000",
        opacity:          overlayOpacity,
        transition:       overlayTransition,
        pointerEvents:    isVisible ? "all" : "none",
        zIndex:           9999,
        overflowY:       "hidden",
      }}>
      {showClose && (
        <CloseButton onClick={() => dispatch("close")} />
      )}
      {showUI && (
        <InputUI
          userInput={userInput}
          setUserInput={(v) => dispatch("inputChange", v)}
          onSubmit={() => dispatch("submit", userInput)}
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
          onRerollClick={() => dispatch("reroll")}
          hasRerolled={hasRerolled}
          rerollCards={rerollCards}
          rerollNarrative={rerollNarrative}
          rerollVisibleCards={rerollVisibleCards}
          showRerollNarrative={showRerollNarrative}
          rerollInput={state.rerollInput ?? ""}
          setRerollInput={(v) => dispatch("rerollInputChange", v)}
          onRerollSubmit={() => dispatch("rerollSubmit", state.rerollInput ?? "")}
          showRerollInput={showRerollInput}
          rerollLoading={rerollLoading}
          scattering={scattering}
        />
      )}
    </div>
  )
}

addPropertyControls(OracleOverlay, {})

// ─── Close Button ─────────────────────────────────────────────────────────────

function CloseButton({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:      "fixed",
        bottom:         16,
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
        position: "fixed",
        top:      0,
        left:     0,
        width:    "100%",
        height:   "100vh",
      }}
    >
      {/* Oracle illustration */}
      <div style={{
        position:  "absolute",
        top:        48,
        left:      "50%",
        transform: "translateX(-50%)",
        width:     "100%",
        maxWidth:   560,
        bottom:     200,
        overflow:  "hidden",
        opacity:    mounted ? 1 : 0,
        transition: "opacity 500ms ease-out",
      }}>
        {oracleImage ? (
          <img
            src={oracleImage}
            alt="The Oracle"
            style={{
              width:           "100%",
              height:          "100%",
              objectFit:       "contain",
              objectPosition:  "top center",
              display:         "block",
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
        position:      "absolute",
        bottom:         48,
        left:          "50%",
        transform:     "translateX(-50%)",
        width:         "100%",
        maxWidth:       560,
        padding:       "0 24px",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:            24,
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
