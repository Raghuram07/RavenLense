import re
from dataclasses import dataclass
from typing import List

@dataclass
class TranscriptLine:
    timestamp: str
    speaker: str
    text: str

def parse_vtt(vtt_content: str) -> List[TranscriptLine]:
    """
    Parse a .vtt file into structured transcript lines.
    Handles both:
      - <v Speaker Name>text          (Teams style)
      - Plain lines after a timestamp (generic style)
    """
    lines = vtt_content.splitlines()
    result: List[TranscriptLine] = []

    current_timestamp = ""
    current_speaker   = ""
    current_text_parts = []

    def flush():
        if current_text_parts and current_speaker:
            result.append(TranscriptLine(
                timestamp=current_timestamp,
                speaker=current_speaker.strip(),
                text=" ".join(current_text_parts).strip()
            ))

    timestamp_re = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}")
    speaker_re   = re.compile(r"<v\s+([^>]+)>(.*)")

    for line in lines:
        line = line.strip()

        if not line or line == "WEBVTT" or line.isdigit():
            continue

        if timestamp_re.match(line):
            flush()
            current_timestamp   = line.split("-->")[0].strip()
            current_speaker     = ""
            current_text_parts  = []
            continue

        m = speaker_re.match(line)
        if m:
            flush()
            current_speaker    = m.group(1)
            current_text_parts = [m.group(2).strip()] if m.group(2).strip() else []
            continue

        # continuation line — no speaker tag
        if current_timestamp:
            if not current_speaker:
                current_speaker = "Unknown"
            current_text_parts.append(line)

    flush()
    return result


def transcript_to_text(lines: List[TranscriptLine]) -> str:
    """Convert parsed lines into clean readable text for the LLM."""
    return "\n".join(f"{l.speaker}: {l.text}" for l in lines)


def get_speakers(lines: List[TranscriptLine]) -> List[str]:
    """Return unique speaker names in order of first appearance."""
    seen  = set()
    order = []
    for l in lines:
        if l.speaker not in seen:
            seen.add(l.speaker)
            order.append(l.speaker)
    return order
