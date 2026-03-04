const res = await fetch("https://oracle-proxy-63hohlnl9-ray-rains-projects.vercel.app/api/reading", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    system: "You are a helpful assistant.",
    messages: [{ role: "user", content: "Say the word CONNECTED and nothing else." }],
  }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
