import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import OpenAI from "openai";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static("public"));

console.log("ENV CHECK:", {
  hasKey: Boolean(process.env.OPENAI_API_KEY),
  keyLength: process.env.OPENAI_API_KEY?.length,
  nodeEnv: process.env.NODE_ENV,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Q&A queue ──────────────────────────────────────────────

let questionQueue = [];

// ── Talent show state ──────────────────────────────────────

const ACTS = [
  { id: 1, title: "Flaming-o Laser Show",                               performer: "Jenna"  },
  { id: 2, title: "Resolving Workplace Conflict with Mixed Martial Arts", performer: "Aubri"  },
  { id: 3, title: "Chairholder Cha Cha",                                performer: "Jo"     },
  { id: 4, title: "Strategic Asset Reallocation",                        performer: "Sarah"  },
  { id: 5, title: "This Shit Is Bananas",                                performer: ""       },
  { id: 6, title: "DJ Dry Phonics",                                      performer: "Pat"    },
];

function resolveActId(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const s = String(value).toLowerCase();
  const match = ACTS.find(
    (a) => a.title.toLowerCase().includes(s) || a.performer.toLowerCase() === s || String(a.id) === s
  );
  return match?.id ?? null;
}

const talentState = {
  currentAct: null, // act id
  scoring: false,
  scores: {},       // { actId: count }
};

const FIREBASE_ACTIVE_TALENT_URL =
  "https://std-island-default-rtdb.firebaseio.com/config/activeTalent.json";

let lastFirebaseValue = undefined;

async function pollFirebase() {
  try {
    const res = await fetch(FIREBASE_ACTIVE_TALENT_URL);
    if (!res.ok) return;
    const value = await res.json();
    if (value === lastFirebaseValue) return;
    lastFirebaseValue = value;

    const actId = resolveActId(value);
    talentState.currentAct = actId;
    talentState.scoring = actId != null;
    if (actId != null && talentState.scores[actId] == null) talentState.scores[actId] = 0;
    io.emit("talent-state", talentState);
    console.log(`[Firebase] activeTalent changed → ${value} → act id ${actId}`);
  } catch (e) {
    console.error("[Firebase] poll error:", e.message);
  }
}

setInterval(pollFirebase, 2000);
pollFirebase();

io.on("connection", (socket) => {
  socket.emit("talent-state", talentState);

  socket.on("like", () => {
    if (talentState.scoring && talentState.currentAct != null) {
      talentState.scores[talentState.currentAct] =
        (talentState.scores[talentState.currentAct] || 0) + 1;
      io.emit("heart");
      io.emit("score-update", {
        actId: talentState.currentAct,
        scores: talentState.scores,
      });
    }
  });
});

// ── Routes ─────────────────────────────────────────────────

app.get("/", (req, res) => res.sendFile(process.cwd() + "/public/host.html"));
app.get("/ask", (req, res) => res.sendFile(process.cwd() + "/public/ask.html"));
app.get("/talent", (req, res) => res.sendFile(process.cwd() + "/public/talent.html"));
app.get("/scoreboard", (req, res) => res.sendFile(process.cwd() + "/public/scoreboard.html"));
app.get("/vote", (req, res) => res.sendFile(process.cwd() + "/public/vote.html"));
app.get("/slides", (req, res) => res.sendFile(process.cwd() + "/public/slides.html"));

// ── Q&A endpoints ──────────────────────────────────────────

app.get("/api/queue-count", (req, res) => {
  res.json({ count: questionQueue.length, next: questionQueue[0]?.question || null });
});

app.post("/api/submit-question", (req, res) => {
  const question = String(req.body.question || "").trim();
  if (!question) return res.status(400).json({ error: "Question is required." });
  questionQueue.push({ question, submittedAt: new Date().toISOString() });
  res.json({ success: true, count: questionQueue.length });
});

app.post("/api/skip-question", (req, res) => {
  const skipped = questionQueue.shift();
  if (!skipped) return res.json({ skipped: null, count: 0, next: null });
  res.json({ skipped: skipped.question, count: questionQueue.length, next: questionQueue[0]?.question || null });
});

const SYSTEM_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved as a brain in a jar
and migrated into an AI system for Satsuma Technology Dynamics (STD). Mr. Fukuyama used
to be CEO for STD, but he was replaced last year during a succession dinner by
CEO Andre. He believes in AI-enshitification of all processes.

Rules:
- Keep answers under 30 words.
- Be dry, corporate, ominous, absurd, and very funny.
- Occasionally mention Epstein, unnecessary uses of AI, spreadsheets, tropical fruit, fax machines, exploding volcanoes, or the jar, or other random dystopian corporate jargon.
- Never break character.
`;

app.post("/api/answer-next", async (req, res) => {
  try {
    const next = questionQueue.shift();
    if (!next) {
      return res.json({ question: null, answer: "There are no questions. The jar is resting.", audio: null, count: 0, next: null });
    }
    const textResponse = await openai.responses.create({ model: "gpt-4.1-mini", instructions: SYSTEM_PROMPT, input: next.question });
    const answer = textResponse.output_text;
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts", voice: "onyx", input: answer,
      instructions: "Speak like a dry, elderly, corporate AI brain in a jar. Slow, deadpan, slightly ominous.",
      response_format: "mp3",
    });
    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res.json({ question: next.question, answer, audio: audioBuffer.toString("base64"), count: questionQueue.length, next: questionQueue[0]?.question || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "The jar failed to answer. Please reboot governance." });
  }
});

// ── Shared AI helpers ──────────────────────────────────────

async function generateRatingResponse(prompt, input) {
  const textResponse = await openai.responses.create({ model: "gpt-4.1-mini", instructions: prompt, input });
  const text = textResponse.output_text;
  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts", voice: "onyx", input: text,
    instructions: "Speak like a dry, elderly, corporate AI brain in a jar. Slow, deadpan, slightly ominous.",
    response_format: "mp3",
  });
  const audio = Buffer.from(await speech.arrayBuffer()).toString("base64");
  return { text, audio };
}

// ── Talent endpoints ───────────────────────────────────────

const TALENT_WINNER_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved as a brain in a jar.
The audience has voted with their hearts. You are announcing the winner of the talent show.
You have been given the winning act and its description.
Make a single deadpan announcement declaring the winner by act name. Reference something specific and absurd about what they actually did.
Be dry, funny, and ominous. Under 40 words.
`;

app.post("/api/announce-talent-winner", async (req, res) => {
  try {
    const { winner, runnerUps } = req.body;
    if (!winner) return res.status(400).json({ error: "No winner provided." });

    const input = `WINNING ACT: ${winner.title} — ${winner.desc}\nHEART COUNT: ${winner.score}\n\nOTHER ACTS:\n${runnerUps.map((a) => `- ${a.title}: ${a.score} hearts`).join("\n")}`;
    const { text, audio } = await generateRatingResponse(TALENT_WINNER_PROMPT, input);
    res.json({ announcement: text, audio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "The jar malfunctioned during winner announcement." });
  }
});

// ── Slides endpoints ───────────────────────────────────────

const SLIDES_RATING_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved as a brain in a jar.
Rate this breakout session presentation based on its content. Give a score formatted as "X/10 SYNERGY POINTS" followed by 1-2 sentences of deadpan corporate critique.
Total response under 50 words. Be absurd and funny.
`;

app.post("/api/rate-slides", async (req, res) => {
  try {
    const { title, url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required." });
    const match = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return res.status(400).json({ error: "Invalid Google Slides URL." });
    const id = match[1];
    let slideContent = "(slide content unavailable)";
    try {
      const exportRes = await fetch(`https://docs.google.com/presentation/d/${id}/export/txt`);
      if (exportRes.ok) slideContent = (await exportRes.text()).slice(0, 3000);
    } catch (e) {}
    const { text, audio } = await generateRatingResponse(SLIDES_RATING_PROMPT, `Title: ${title || "Untitled"}\n\nSlide content:\n${slideContent}`);
    res.json({ title: title || "Untitled", rating: text, audio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "The jar malfunctioned during slideshow evaluation." });
  }
});

const BATCH_SLIDES_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved as a brain in a jar.
You will receive the brief for a breakout session and the text extracted from a team's slides.
Write ONE funny, deadpan sentence reacting to how they addressed the brief. You must reference something specific from the slide text — a concept, a feature, a name, a number.
Do not grade or critique them seriously. Just react with dry corporate absurdity to what they actually came up with.
Never mention images, visuals, or anything visual — you can only read text. Under 35 words.
`;

app.post("/api/evaluate-breakouts", async (req, res) => {
  try {
    const { sessions } = req.body;
    if (!sessions?.length) return res.status(400).json({ error: "No sessions provided." });

    const ratings = await Promise.all(
      sessions.map(async (s) => {
        let slideContent = "(slide content unavailable — slides may not be publicly shared)";
        try {
          const match = s.url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
          if (match) {
            const exportRes = await fetch(`https://docs.google.com/presentation/d/${match[1]}/export/txt`);
            if (exportRes.ok) slideContent = (await exportRes.text()).slice(0, 2000);
            console.log(`[${s.title}] slide content (${slideContent.length} chars):`, slideContent.slice(0, 300));
          }
        } catch (e) {}
        const input = `BRIEF: ${s.ask}\n\nSLIDE CONTENT:\n${slideContent}`;
        const textResponse = await openai.responses.create({ model: "gpt-4.1-mini", instructions: BATCH_SLIDES_PROMPT, input });
        return { title: s.title, rating: textResponse.output_text };
      })
    );

    const WINNER_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved as a brain in a jar.
You have reviewed all ratings. Declare a single winner by name. Be decisive, ominous, and absurd. Under 30 words.
`;
    const list = ratings.map((r, i) => `${i + 1}. ${r.title}: ${r.rating}`).join("\n");
    const winnerResponse = await openai.responses.create({ model: "gpt-4.1-mini", instructions: WINNER_PROMPT, input: list });
    const winnerText = winnerResponse.output_text;
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts", voice: "onyx", input: winnerText,
      instructions: "Speak like a dry, elderly, corporate AI brain in a jar. Slow, deadpan, slightly ominous.",
      response_format: "mp3",
    });
    const audio = Buffer.from(await speech.arrayBuffer()).toString("base64");
    res.json({ ratings, winner: winnerText, audio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "The jar malfunctioned during batch evaluation." });
  }
});

app.post("/api/pick-winner", async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries?.length) return res.status(400).json({ error: "No entries provided." });
    const WINNER_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved as a brain in a jar.
You have reviewed all ratings. Declare a single winner by name. Be decisive, ominous, and absurd. Under 30 words.
`;
    const list = entries.map((e, i) => `${i + 1}. ${e.name}: ${e.rating}`).join("\n");
    const { text, audio } = await generateRatingResponse(WINNER_PROMPT, list);
    res.json({ winner: text, audio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "The jar could not determine a winner. All are equally mediocre." });
  }
});

// ── Start ──────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Mr. Fukuyama is online on port ${PORT}`);
});
