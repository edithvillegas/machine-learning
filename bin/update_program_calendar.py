#!/usr/bin/env python3
"""Download the school's public Google Calendar and save its events for the Programa page.

The page can't read Google's feed directly from a visitor's browser (Google blocks it),
so this script runs on GitHub (see .github/workflows/update-calendar.yml) and writes
assets/json/program-events.json, which assets/js/program-calendar.js then reads.

Only the title, start and end of each event are saved (no descriptions or meeting links).

Usage:  python3 bin/update_program_calendar.py [output_path]
Uses only the Python standard library.
"""

import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

CALENDAR_ID = "95c72dd39a459df4b364520357d853c99a8c3db9cf65abdfd688d0494b75935d@group.calendar.google.com"
FEED_URL = "https://calendar.google.com/calendar/ical/" + CALENDAR_ID.replace("@", "%40") + "/public/basic.ics"
DEFAULT_OUTPUT = "assets/json/program-events.json"


def unescape(text):
    return text.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")


def parse_time(name, value):
    """Turn an ICS date/time property into the {"date"} / {"dateTime"} shape the page expects."""
    params = dict(p.split("=", 1) for p in name.split(";")[1:] if "=" in p)
    if params.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", value):
        return {"date": f"{value[:4]}-{value[4:6]}-{value[6:8]}"}
    dt = datetime.strptime(value.rstrip("Z"), "%Y%m%dT%H%M%S")
    if value.endswith("Z"):
        dt = dt.replace(tzinfo=timezone.utc)
    elif "TZID" in params:
        dt = dt.replace(tzinfo=ZoneInfo(params["TZID"]))
    else:  # floating time: treat as Honduras time
        dt = dt.replace(tzinfo=ZoneInfo("America/Tegucigalpa"))
    return {"dateTime": dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}


def parse_ics(text):
    # Undo line folding (continuation lines start with a space or tab).
    text = re.sub(r"\r?\n[ \t]", "", text)
    events = []
    for block in re.findall(r"BEGIN:VEVENT\r?\n(.*?)END:VEVENT", text, re.S):
        props = {}
        for line in block.splitlines():
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            props.setdefault(name.split(";")[0].upper(), (name, value.strip()))
        if "DTSTART" not in props:
            continue
        if "RRULE" in props:
            print(f"Warning: repeating event only shown once: {props.get('SUMMARY', ('', ''))[1]}", file=sys.stderr)
        start = parse_time(*props["DTSTART"])
        end = parse_time(*props["DTEND"]) if "DTEND" in props else start
        status = props.get("STATUS", ("", "CONFIRMED"))[1].lower()
        events.append({
            "summary": unescape(props.get("SUMMARY", ("", ""))[1]).strip(),
            "start": start,
            "end": end,
            "status": status,
        })
    events.sort(key=lambda e: e["start"].get("dateTime") or e["start"].get("date"))
    return events


def main():
    output = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUTPUT
    with urllib.request.urlopen(FEED_URL, timeout=30) as resp:
        text = resp.read().decode("utf-8")
    if "BEGIN:VCALENDAR" not in text:
        sys.exit("The calendar feed did not return a calendar; is the calendar still public?")
    events = parse_ics(text)
    with open(output, "w", encoding="utf-8") as f:
        json.dump({"items": events}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"Saved {len(events)} events to {output}")


if __name__ == "__main__":
    main()
