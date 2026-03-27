export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — replace with your GitHub Pages URL once deployed
  // e.g. https://yourusername.github.io
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { transcript } = req.body;

    if (!transcript || transcript.length < 80) {
      return res.status(400).json({ error: 'Transcript too short.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are an expert in the Ivey Leader Character Framework (Ivey Business School).
Analyze this meeting transcript. Score each of these 9 dimensions 0–100 based only on behavioral evidence: Drive, Collaboration, Humanity, Humility, Integrity, Accountability, Courage, Transcendence, Justice. Use 50 for dimensions not clearly evidenced.
Compute overall_score as a weighted average.

Reply ONLY with this exact JSON (no markdown, no extra text):
{"overall_score":number,"dimensions":[{"name":string,"score":number,"reason":string}],"strengths":[string,string,string],"improvements":[string,string,string],"summary":string,"next_action":string}

Rules: "reason" max 15 words. strengths/improvements = specific behavioral observations. next_action = one concrete thing to do differently in the very next meeting.

Transcript:
${transcript}`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const raw  = (data.content || []).find(b => b.type === 'text')?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
