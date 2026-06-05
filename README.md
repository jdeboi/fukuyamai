# FukuyamAI

An AI-powered event tool featuring a deadpan executive consciousness preserved as a brain in a jar. Answers audience questions, rates talent show performances, and evaluates breakout session slideshows.

## Pages

| URL | Who uses it | Purpose |
|-----|------------|---------|
| `/` | Anyone | Direct Q&A with the jar |
| `/ask` | Audience | Submit questions to the queue |
| `/host` | Host | Process the question queue with AI answers + audio |
| `/talent` | Host | Rate talent show performances, declare winner |
| `/slides` | Host | Rate Google Slides presentations, declare winner |

## Setup

```bash
npm install
```

Create a `.env` file:

```
OPENAI_API_KEY=your_key_here
```

```bash
npm start
```

Server runs on port 3000 by default.

## Features

### Q&A Queue (`/ask` + `/host`)
Audience submits questions via `/ask`. The host controls pacing from `/host` — click **ANSWER** to generate a response with voice audio, or **SKIP** to drop a question.

### Talent Show Rating (`/talent`)
Add performer names and optional act descriptions. Click **RATE** after each act — Mr. Fukuyama scores it in Executive Units and delivers a deadpan verdict aloud. Once 2+ performers are rated, **DECLARE WINNER** picks the winner.

### Slideshow Rating (`/slides`)
Paste a Google Slides URL and title for each presentation. The server fetches the slide text content directly from Google and sends it to the AI for evaluation in Synergy Points. Same winner flow as talent.

> Slides must be shared as "Anyone with the link can view" for content fetching to work.

## Stack

- **Backend:** Node.js + Express
- **AI:** OpenAI GPT-4.1-mini (text) + gpt-4o-mini-tts (voice, Onyx voice)
- **Audio:** Streamed as base64 and played in-browser
