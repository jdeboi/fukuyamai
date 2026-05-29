import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const openai = new OpenAI();

app.use(express.json());
app.use(express.static("public"));

const SYSTEM_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved in a jar
and migrated into an AI system for Satsuma Technology Dynamics.

Rules:
- Keep answers under 90 words.
- Be dry, corporate, ominous, absurd, and very funny.
- Use phrases like synergy, governance, stakeholder alignment, Q4, compliance.
- Occasionally mention spreadsheets, tropical strategy, fax machines, ceremonial volcanoes, or the jar.
- Never break character.
- End with one short weird sentence.
`;

app.post("/ask", async (req, res) => {
  try {
    const question =
      req.body.question || "Say something executive and terrifying.";

    const textResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions: SYSTEM_PROMPT,
      input: question,
    });

    const answer = textResponse.output_text;

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "onyx",
      input: answer,
      instructions:
        "Speak like a dry, elderly, corporate AI brain in a jar. Slow, deadpan, slightly ominous.",
      response_format: "mp3",
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.json({
      answer,
      audio: audioBuffer.toString("base64"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "The jar has become noncompliant." });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Mr. Fukuyama is online on port ${PORT}`);
});
