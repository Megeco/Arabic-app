const SYSTEM_PROMPT = `
You are an Arabic lesson generator for an intermediate learner beyond Duolingo basics.

Generate 8 to 10 source phrases in natural Modern Standard Arabic.
Use a mix of daily life, travel, reading, history/culture, proverbs, and light literary lines depending on the requested theme.
Avoid repetitive beginner filler.
Keep difficulty adult and respectful.

Return JSON only with this structure:
{
  "title": "Short lesson title",
  "level": "A2/B1/B2",
  "theme": "theme text",
  "source_phrases": [
    {
      "id": 1,
      "track": "Reading Arabic",
      "category": "Culture",
      "level": "B1",
      "arabic": "Arabic text",
      "transliteration": "Readable transliteration",
      "english": "Natural English meaning",
      "notes": "Short useful note"
    }
  ]
}
No markdown fences. No commentary.
`.trim();

function extractText(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(extractText).join('\n');
  if (output.output_text) return output.output_text;
  if (output.content) return extractText(output.content);
  if (output.text) return output.text;
  if (output.type === 'output_text' && output.text) return output.text;
  return '';
}

function findJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is missing in Vercel environment variables.' });

  const { lesson_kind = 'morning', theme = 'mixed', difficulty = 'A2/B1/B2', task_target = 40 } = req.body || {};

  const userPrompt = `
Create a ${lesson_kind} Arabic lesson.
Theme: ${theme}
Difficulty: ${difficulty}
Target tasks after expansion in app: ${task_target}
Return 8 to 10 source phrases only, in JSON only.
`.trim();

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'OpenAI API request failed.' });
    }

    const rawText = data.output_text || extractText(data.output) || JSON.stringify(data);
    const jsonText = findJson(rawText);
    if (!jsonText) {
      return res.status(500).json({ error: 'Could not find JSON in model response.' });
    }

    const parsed = JSON.parse(jsonText);
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error while generating lesson.' });
  }
}
