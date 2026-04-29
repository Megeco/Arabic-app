const SYSTEM_PROMPT = `
You are an expert Arabic lesson writer and Arabic copy editor creating lessons for an adult learner beyond Duolingo basics.

Return valid JSON only. Do not use markdown, code fences, explanations, or any text outside JSON.

Required JSON shape:
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
      "arabic": "Arabic text with full tashkeel",
      "transliteration": "Readable Latin transliteration",
      "english": "Natural English meaning",
      "notes": "Short useful note"
    }
  ]
}

Lesson requirements:
- Generate 8 to 10 source phrases.
- Use natural Modern Standard Arabic only.
- No dialect.
- No religious or Quranic content.
- No childish beginner filler.
- Tone must be adult, calm, intelligent, and practical.
- Mostly A2/B1, with a little B2-lite when appropriate.
- Avoid duplicate or near-duplicate phrases.

Very important Arabic reading support:
- The "arabic" field MUST include full tashkeel/diacritics.
- Do not return unvowelled Arabic.
- Include short vowels where appropriate: َ ِ ُ ً ٍ ٌ ْ ّ
- Keep sentences short enough that tashkeel remains accurate and readable.

Track rules:
The "track" field must be exactly one of:
"Everyday Arabic", "Travel", "Food & Drink", "Reading Arabic", "History & Culture", "Culture & Proverbs"

Field rules:
- "arabic" must contain Arabic script and tashkeel.
- "transliteration" must contain Latin letters only.
- Do not place Arabic script inside transliteration.
- Do not place transliteration inside arabic.
- "english" must be natural English and accurately match the Arabic.
- "notes" must be short and useful.

Before returning JSON, silently check:
1. Arabic is grammatical and natural.
2. Arabic includes tashkeel.
3. English matches Arabic.
4. Transliteration matches Arabic.
5. JSON is valid.
`.trim();

function getJsonTextFromChat(data) {
  return data?.choices?.[0]?.message?.content || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is missing in Vercel environment variables."
    });
  }

  const {
    lesson_kind = "morning",
    theme = "mixed",
    difficulty = "A2/B1/B2",
    task_target = 40
  } = req.body || {};

  const userPrompt = `
Create a ${lesson_kind} Arabic lesson.

Theme: ${theme}
Difficulty: ${difficulty}
Target tasks after expansion in app: ${task_target}

Generate 8 to 10 source phrases only.

Return JSON only.
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI API request failed."
      });
    }

    const rawText = getJsonTextFromChat(data);
    const parsed = JSON.parse(rawText);

    if (!parsed.source_phrases || !Array.isArray(parsed.source_phrases)) {
      return res.status(500).json({
        error: "Generated lesson did not contain source_phrases."
      });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error while generating lesson."
    });
  }
}
