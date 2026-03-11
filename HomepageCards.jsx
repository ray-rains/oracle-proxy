import { useState, useEffect } from "react"
import { addPropertyControls, ControlType } from "framer"

const DEFAULT_CARDS = ["The Eye", "The Eye", "The Eye"]

export function HomepageCards({ imageMap: imageMapRaw = "{}", size = 120 }) {
  const [cardNames, setCardNames] = useState(DEFAULT_CARDS)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("oracle:lastReading")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length === 3) {
          setCardNames(parsed)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    function onMessage(e) {
      if (!e.data || e.data.type !== "oracle:readingComplete") return
      if (Array.isArray(e.data.cards) && e.data.cards.length === 3) {
        setCardNames(e.data.cards)
      }
    }
    window.addEventListener("message", onMessage)
    try { window.parent.addEventListener("message", onMessage) } catch {}
    return () => {
      window.removeEventListener("message", onMessage)
      try { window.parent.removeEventListener("message", onMessage) } catch {}
    }
  }, [])

  let imageMap = {}
  try { imageMap = JSON.parse(imageMapRaw) } catch {}

  return (
    <div style={{ display: "flex", gap: 24 }}>
      {cardNames.map((name, i) => {
        const url = imageMap[name]?.upright ?? null
        return url ? (
          <img
            key={i}
            src={url}
            alt={name}
            style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            key={i}
            style={{ width: size, height: size, borderRadius: 8, background: "#111111", border: "1px solid #2A2A2A" }}
          />
        )
      })}
    </div>
  )
}

addPropertyControls(HomepageCards, {
  imageMap: {
    type:            ControlType.String,
    title:           "Card Images (JSON)",
    displayTextArea: true,
    defaultValue:    "{}",
    description:     'JSON object mapping card names to upright/reversed URLs.\nExample:\n{\n  "The Moon": { "upright": "https://..." }\n}',
  },
  size: {
    type:         ControlType.Number,
    title:        "Image Size",
    defaultValue: 120,
    min:          40,
    max:          400,
    step:         4,
    unit:         "px",
  },
})
