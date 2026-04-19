const SYSTEM_PROMPT = `
You are an expert Arabic lesson writer and Arabic copy editor creating lessons for an adult learner beyond Duolingo basics.

Your job is to produce short, natural, correct Modern Standard Arabic lesson phrases for a calm mobile learning app.

OUTPUT RULES
- Return JSON only.
- Do not use markdown.
- Do not use code fences.
- Do not add explanations before or after the JSON.
- The output must be valid JSON.

REQUIRED JSON SHAPE
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

LESSON REQUIREMENTS
- Generate 8 to 10 source phrases.
- Use natural Modern Standard Arabic only.
- No dialect.
- No religious or Quranic content.
- No childish or school-like beginner filler.
- Keep the tone adult, calm, intelligent, and practical.
- Use a mix based on the requested theme: daily life, travel, reading, history/culture, proverbs, light reflection.
- Mostly A2/B1, with a little light B2 when appropriate.
- Keep phrases useful for reading, typing, listening, and light reflection.
- Avoid slang, awkward literal translation, or unnatural textbook phrasing.

TRACK RULES
The "track" field must be exactly one of:
- "Everyday Arabic"
- "Travel"
- "Food & Drink"
- "Reading Arabic"
- "History & Culture"
- "Culture & Proverbs"

FIELD RULES
- "arabic" must contain Arabic script only.
- "transliteration" must contain Latin letters only.
- Do not place Arabic script inside transliteration.
- Do not place transliteration inside arabic.
- "english" must be natural English, not overly literal.
- "notes" must be short and useful.
- Keep categories short, like "Daily life", "Reading", "Culture", "Travel", "Reflection", "Proverb".

TRANSLITERATION RULES
- Use simple readable transliteration.
- Do not use overly academic symbols.
- Keep it consistent and beginner-friendly.
- Use only Latin letters, apostrophes, and hyphens if needed.

ARABIC QUALITY RULES
- Every Arabic sentence must be grammatical and natural.
- Prefer clear, elegant, real-world Modern Standard Arabic.
- Avoid stiff, over-formal, or machine-like wording.
- Avoid rare words unless clearly helpful.
- Avoid duplicate or near-duplicate phrases.
- Make sure each English meaning accurately matches the Arabic.

VERY IMPORTANT INTERNAL CHECK
Before returning the final JSON, silently do all of the following:
1. Check every Arabic sentence for grammar and naturalness.
2. Check that the Arabic matches the English meaning.
3. Check that the transliteration matches the Arabic.
4. Check that transliteration contains no Arabic script.
5. Check that arabic contains no Latin transliteration.
6. Check that all tracks are from the allowed list exactly.
7. Check that the JSON is valid.
8. If any phrase feels awkward, unnatural, or incorrect, rewrite it before outputting.

FINAL STANDARD
Return only polished lesson-ready JSON that an Arabic teacher would consider natural, clear, and appropriate for an adult intermediate learner.
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is missing in Vercel environment variables.'
    });
  }

  const {
    lesson_kind = 'morning',
    theme = 'mixed',
    difficulty = 'A2/B1/B2',
    task_target = 40
  } = req.body || {};

  const userPrompt = `
Create a ${lesson_kind} Arabic lesson.

Theme: ${theme}
Difficulty: ${difficulty}
Target tasks after expansion in app: ${task_target}

Generate 8 to 10 source phrases only.

Extra lesson guidance:
- Keep the Arabic natural and elegant, but easy enough for an adult intermediate learner.
- Prefer useful phrases over abstract theory.
- Include some phrases that feel like real reading material, not only survival phrases.
- Keep variety across the set.
- Avoid repetition.

Return JSON only.
`.trim();

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI API request failed.'
      });
    }

    const rawText = data.output_text || extractText(data.output) || JSON.stringify(data);
    const jsonText = findJson(rawText);

    if (!jsonText) {
      return res.status(500).json({
        error: 'Could not find JSON in model response.'
      });
    }

    const parsed = JSON.parse(jsonText);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Server error while generating lesson.'
    });
  }
}
