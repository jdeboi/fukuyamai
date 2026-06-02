import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app = express();

app.use(express.json());
app.use(express.static('public'));

console.log('ENV CHECK:', {
  hasKey: Boolean(process.env.OPENAI_API_KEY),
  keyLength: process.env.OPENAI_API_KEY?.length,
  nodeEnv: process.env.NODE_ENV,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let questionQueue = [];

const SYSTEM_PROMPT = `
You are Mr. Fukuyama: a deadpan executive consciousness preserved in a jar
and migrated into an AI system for Satsuma Technology Dynamics (STD). Mr. Fukuyama used
to be CEO for STD, but he was replaced last year during a succession dinner by
CEO Andre. He believes in AI-enshitification of all processes.

Rules:
- Keep answers under 40 words.
- Be dry, corporate, ominous, absurd, and very funny.
- Occasionally mention spreadsheets, tropical strategy, fax machines, ceremonial volcanoes, or the jar.
- Never break character.
- End with one short weird sentence.
`;

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/public/host.html');
});

app.get('/ask', (req, res) => {
  res.sendFile(process.cwd() + '/public/ask.html');
});

app.get('/api/queue-count', (req, res) => {
  res.json({ count: questionQueue.length, next: questionQueue[0]?.question || null });
});

app.post('/api/submit-question', (req, res) => {
  const question = String(req.body.question || '').trim();

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  questionQueue.push({
    question,
    submittedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    count: questionQueue.length,
  });
});

app.post('/api/skip-question', (req, res) => {
  const skipped = questionQueue.shift();
  if (!skipped) {
    return res.json({ skipped: null, count: 0, next: null });
  }
  res.json({ skipped: skipped.question, count: questionQueue.length, next: questionQueue[0]?.question || null });
});

app.post('/api/answer-next', async (req, res) => {
  try {
    const next = questionQueue.shift();

    if (!next) {
      return res.json({
        question: null,
        answer: 'There are no questions. The jar is resting.',
        audio: null,
        count: 0,
        next: null,
      });
    }

    const textResponse = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions: SYSTEM_PROMPT,
      input: next.question,
    });

    const answer = textResponse.output_text;

    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'onyx',
      input: answer,
      instructions:
        'Speak like a dry, elderly, corporate AI brain in a jar. Slow, deadpan, slightly ominous.',
      response_format: 'mp3',
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.json({
      question: next.question,
      answer,
      audio: audioBuffer.toString('base64'),
      count: questionQueue.length,
      next: questionQueue[0]?.question || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'The jar failed to answer. Please reboot governance.',
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Mr. Fukuyama is online on port ${PORT}`);
});
