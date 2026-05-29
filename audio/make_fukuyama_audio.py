# python3 -m venv venv
# source venv/bin/activate
# pip install openai pillow python-dotenv
# python3 make_fukuyama_audio.py

from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

OUT_DIR = Path("fukuyama_audio")
OUT_DIR.mkdir(exist_ok=True)

clips = [
    {
        "filename": "01_infinite_knowledge.mp3",
        "text": """
        Accessing jar memory. Rehydrating executive cognition.

        The single most important thing I have learned is that the true purpose
        of all organizations is the generation of increasingly specific spreadsheet tabs.

        Please do not ask a follow-up question. I have already optimized the silence.
        """
    },
]
clips2 = [
    {
        "filename": "01_infinite_knowledge.mp3",
        "text": """
        Accessing jar memory. Rehydrating executive cognition.

        The single most important thing I have learned is that the true purpose
        of all organizations is the generation of increasingly specific spreadsheet tabs.

        Please do not ask a follow-up question. I have already optimized the silence.
        """
    },
    {
        "filename": "02_greatest_regret.mp3",
        "text": """
        My greatest regret as a human was spending forty-three years attending meetings
        that could have been emails, and reading emails that should have been meetings.

        In the cloud, this contradiction has only deepened.
        """
    },
    {
        "filename": "03_future_vision.mp3",
        "text": """
        I have simulated four point seven million futures for Satsuma Technology Dynamics.

        In every successful timeline, the company acquires three additional vice presidents,
        one ceremonial volcano, and a compliance parrot named Deborah.

        The volcano handles governance.
        """
    },
    {
        "filename": "04_next_ceo_guidance.mp3",
        "text": """
        My guidance to the next CEO is simple.

        Never reveal your true priorities.

        Publish them as a PDF. Place the PDF inside a zip file.
        Email it with the subject line: Draft version seventeen, final, final, two.

        Then leave for a leadership retreat.
        """
    },
    {
        "filename": "05_final_love.mp3",
        "text": """
        Analyzing emotional residue.

        Love was deprecated in version three point two.

        However, employee satisfaction remains within acceptable parameters.

        I have selected the next CEO.

        It is the spreadsheet.
        """
    },
]

for clip in clips:
    path = OUT_DIR / clip["filename"]

    with client.audio.speech.with_streaming_response.create(
        model="gpt-4o-mini-tts",
        voice="onyx",
        input=clip["text"],
        instructions="""
        Voice: dry, corporate, slightly robotic, elderly Japanese executive brain in a jar.
        Tone: serious, deadpan, ominous, absurd.
        Pace: slow with awkward pauses.
        Emotion: deeply confident but spiritually malfunctioning.
        """
    ) as response:
        response.stream_to_file(path)

    print(f"Created {path}")