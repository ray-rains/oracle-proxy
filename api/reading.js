export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return res.status(200).set(corsHeaders).end();
  }

  try {
    const { messages, system } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system,
        messages,
      }),
    });

    const data = await response.json();

    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(response.status).json(data);
  } catch (error) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
    };
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(500).json({ error: error.message });
  }
}
