"""
Lucy's Birds — the analyzer.

Takes one uploaded recording, runs BirdNET over it, writes what it heard to
Postgres. This is the piece that used to be a daemon on a Raspberry Pi watching
a folder; here it's a plain request handler, because uploads arrive one at a
time and there's nothing to watch.

POST { "recordingId": "<uuid>" }
"""

import datetime
import json
import os
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler

import requests

# BirdNET's own confidence floor. Lower than a Pi-in-a-window setup would use:
# a phone held at arm's length in wind is a noisier signal than a lavalier mic
# taped to a window, and we'd rather show Lucy a maybe she can reject than
# silently drop a real bird.
MIN_CONFIDENCE = 0.15

_analyzer = None


def get_analyzer():
    """Load the BirdNET model once per warm instance — it's ~50 MB and slow to init."""
    global _analyzer
    if _analyzer is None:
        from birdnetlib.analyzer import Analyzer

        _analyzer = Analyzer()
    return _analyzer


def env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environment variable {name}")
    return value


def rest_headers():
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def patch_recording(recording_id, payload):
    requests.patch(
        f"{env('SUPABASE_URL')}/rest/v1/recordings",
        params={"id": f"eq.{recording_id}"},
        headers=rest_headers(),
        json=payload,
        timeout=30,
    ).raise_for_status()


def analyze(recording_id):
    base = env("SUPABASE_URL")

    lookup = requests.get(
        f"{base}/rest/v1/recordings",
        params={
            "id": f"eq.{recording_id}",
            "select": "id,storage_path,recorded_at,lat,lon",
        },
        headers=rest_headers(),
        timeout=30,
    )
    lookup.raise_for_status()
    rows = lookup.json()
    if not rows:
        raise LookupError(f"No recording with id {recording_id}")
    recording_row = rows[0]

    patch_recording(recording_id, {"status": "analyzing", "error": None})

    # recorded_at anchors every detection. BirdNET reports offsets in seconds
    # from the start of the file, so a four-minute walk comes back as several
    # birds at the right minute each rather than one undifferentiated blob.
    recorded_at = datetime.datetime.fromisoformat(
        recording_row["recorded_at"].replace("Z", "+00:00")
    )

    audio = requests.get(
        f"{base}/storage/v1/object/recordings/{recording_row['storage_path']}",
        headers={"Authorization": f"Bearer {env('SUPABASE_SERVICE_ROLE_KEY')}"},
        timeout=120,
    )
    audio.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as handle:
        handle.write(audio.content)
        handle.flush()

        from birdnetlib import Recording

        kwargs = {"min_conf": MIN_CONFIDENCE, "date": recorded_at.date()}
        # Location is optional but a big accuracy win: it drops species that
        # aren't plausible where Lucy is, that week of the year.
        if recording_row.get("lat") is not None and recording_row.get("lon") is not None:
            kwargs["lat"] = recording_row["lat"]
            kwargs["lon"] = recording_row["lon"]

        recording = Recording(get_analyzer(), handle.name, **kwargs)
        recording.analyze()
        detections = recording.detections

    rows_to_insert = [
        {
            "source": "heard",
            "recording_id": recording_id,
            "sci_name": d["scientific_name"],
            "com_name": d["common_name"],
            "confidence": round(float(d["confidence"]), 4),
            "start_seconds": float(d["start_time"]),
            "end_seconds": float(d["end_time"]),
            "seen_at": (
                recorded_at + datetime.timedelta(seconds=float(d["start_time"]))
            ).isoformat(),
        }
        for d in detections
    ]

    if rows_to_insert:
        requests.post(
            f"{base}/rest/v1/sightings",
            headers=rest_headers(),
            json=rows_to_insert,
            timeout=60,
        ).raise_for_status()

    patch_recording(recording_id, {"status": "done", "error": None})
    return len(rows_to_insert)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        recording_id = None
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            recording_id = body.get("recordingId")
            if not recording_id:
                return self.respond(400, {"error": "recordingId is required"})

            found = analyze(recording_id)
            self.respond(200, {"ok": True, "detections": found})

        except Exception as exc:  # noqa: BLE001 - the message has to reach the UI
            traceback.print_exc()
            message = f"{type(exc).__name__}: {exc}"
            if recording_id:
                try:
                    patch_recording(recording_id, {"status": "failed", "error": message})
                except Exception:  # noqa: BLE001
                    traceback.print_exc()
            self.respond(500, {"error": message})

    def respond(self, status, payload):
        encoded = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)
