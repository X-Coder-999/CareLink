export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symptoms, severity, duration } = req.body;

  if (!symptoms || !severity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{
          role: 'user',
          content: `You are a medical AI assistant. Patient symptoms: ${symptoms.join(', ')}. Severity: ${severity}. Duration: ${duration} days. Respond ONLY with valid JSON, no markdown: {"conditions":[{"name":"string","likelihood":"low or medium or high","description":"1-2 sentences","recommendation":"brief advice"}],"specialty":"recommended specialist","urgent":true or false}`
        }],
        temperature: 0.3,
        max_tokens: 800
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyse symptoms' });
  }
}
