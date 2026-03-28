export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
        max_tokens: 1800,
        messages: [{
          role: 'user',
          content: `You are an expert in the Ivey Leader Character Framework (Ivey Business School).
Analyze this meeting transcript. Score each of these 9 dimensions 0-100 based only on behavioral evidence: Drive, Collaboration, Humanity, Humility, Integrity, Accountability, Courage, Transcendence, Justice. Use 50 for dimensions not clearly evidenced.
Compute overall_score as a weighted average.

IMPORTANT: Reply ONLY with a single valid JSON object. No markdown, no backticks, no explanation before or after. Start your response with { and end with }.

The JSON must follow this exact structure:
{
  "overall_score": 72,
  "dimensions": [
    {"name": "Drive", "score": 80, "reason": "Team showed initiative and pushed for decisions."},
    {"name": "Collaboration", "score": 75, "reason": "Multiple voices included in decision making."},
    {"name": "Humanity", "score": 60, "reason": "Some acknowledgment of team concerns shown."},
    {"name": "Humility", "score": 65, "reason": "Leader admitted mistakes openly."},
    {"name": "Integrity", "score": 70, "reason": "Commitments were clear and consistent."},
    {"name": "Accountability", "score": 78, "reason": "Clear owners assigned for each action item."},
    {"name": "Courage", "score": 68, "reason": "Difficult truths were named directly."},
    {"name": "Transcendence", "score": 55, "reason": "Some reference to broader mission evident."},
    {"name": "Justice", "score": 62, "reason": "Fair process with equitable voice given."}
  ],
  "strengths": [
    "First specific behavioral strength observed in the transcript.",
    "Second specific behavioral strength observed in the transcript.",
    "Third specific behavioral strength observed in the transcript."
  ],
  "improvements": [
    "First specific behavioral improvement opportunity.",
    "Second specific behavioral improvement opportunity.",
    "Third specific behavioral improvement opportunity."
  ],
  "summary": "One or two sentence summary of the overall character of this meeting.",
  "next_action": "One specific concrete thing to do differently in the very next meeting."
}

Keep each reason under 15 words. Strengths and improvements must be specific behavioral observations, not generic advice.

Now analyze this transcript:
${transcript}`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const raw = (data.content || []).find(b => b.type === 'text')?.text || '';

    // Try multiple strategies to extract valid JSON
    let parsed = null;

    // Strategy 1: direct parse
    try {
      parsed = JSON.parse(raw.trim());
    } catch (_) {}

    // Strategy 2: strip markdown code blocks
    if (!parsed) {
      try {
        const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(stripped);
      } catch (_) {}
    }

    // Strategy 3: extract first {...} block
    if (!parsed) {
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch (_) {}
    }

    // Strategy 4: find the JSON by locating overall_score
    if (!parsed) {
      try {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(raw.substring(start, end + 1));
        }
      } catch (_) {}
    }

    if (!parsed) {
      return res.status(500).json({ error: 'Could not parse AI response. Please try again.' });
    }

    return res.status(200).json(parsed);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
