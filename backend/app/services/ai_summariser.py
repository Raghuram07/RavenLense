import os
import json
import re
from anthropic import AsyncAnthropic

SYSTEM_PROMPT = """You are RavenLens, an expert AI Scrum Master and meeting intelligence assistant.
Your job is to analyse meeting transcripts and produce accurate, structured Minutes of Meeting.
Always respond ONLY with valid JSON — no markdown, no preamble, no explanation."""

MOM_PROMPT = """Analyse this meeting transcript and return a JSON object with exactly these keys:

{{
  "attendees": ["list of every speaker name who appeared"],
  "decisions": ["list of key decisions made — be specific"],
  "action_items": [
    {{
      "owner": "person responsible",
      "task": "clear description of what they need to do",
      "due": "due date if mentioned, otherwise null"
    }}
  ],
  "blockers": ["list of anything flagged as blocked, waiting, or at risk"],
  "summary": "3 clear sentences summarising the meeting — what was discussed, what was decided, what happens next",
  "full_mom": "A formatted Minutes of Meeting as a professional plain-text document with all sections"
}}

Rules:
- Only include action items that were explicitly assigned to someone
- Decisions must be actual conclusions reached, not just topics discussed
- If nothing was blocked, return an empty array for blockers
- The full_mom field should be formatted with clear section headers

Meeting Title: {title}

Meeting Transcript:
{transcript}
"""

async def generate_mom(transcript: str, meeting_title: str = "") -> dict:
    """
    Send transcript to Claude and get back structured MOM.
    Returns a dict with keys: attendees, decisions, action_items, blockers, summary, full_mom
    """
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise EnvironmentError("ANTHROPIC_API_KEY is not set in .env")
    client = AsyncAnthropic(api_key=key)
    prompt = MOM_PROMPT.format(title=meeting_title or "Untitled", transcript=transcript)
    message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

    raw = message.content[0].text.strip()

    # Strip any accidental markdown fences
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*",     "", raw)
    raw = re.sub(r"\s*```$",     "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return raw text wrapped in basic structure
        return {
            "attendees":    [],
            "decisions":    [],
            "action_items": [],
            "blockers":     [],
            "summary":      raw[:500],
            "full_mom":     raw
        }
