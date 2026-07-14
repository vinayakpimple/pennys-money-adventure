#!/usr/bin/env python3
"""Generate narration MP3s from tts/narration.json using the open-source
Kokoro-82M voice (Apache-2.0). Output: audio/<hash>.mp3, one per string.
Incremental — existing non-empty clips are skipped. See tts/README.md."""
import json, os, time
import numpy as np
import soundfile as sf   # noqa: F401 (ensures libsndfile present)
import lameenc
from kokoro import KPipeline

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "audio")
os.makedirs(OUT, exist_ok=True)
entries = json.load(open(os.path.join(ROOT, "tts", "narration.json")))

VOICE = "af_heart"          # warm US female — chosen for Penny
pipe = KPipeline(lang_code="a")


def to_mp3(audio):
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(24000)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()


t0 = time.time()
done = skip = 0
for i, ent in enumerate(entries):
    out = os.path.join(OUT, ent["hash"] + ".mp3")
    if os.path.exists(out) and os.path.getsize(out) > 0:
        skip += 1
        continue
    audio = np.concatenate([g.audio for g in pipe(ent["tts"], voice=VOICE, speed=1.0)])
    with open(out, "wb") as f:
        f.write(to_mp3(audio))
    done += 1
    print("[%d/%d] %s.mp3  %.1fs audio  (%.0fs elapsed)"
          % (i + 1, len(entries), ent["hash"], len(audio) / 24000, time.time() - t0), flush=True)

mp3s = [f for f in os.listdir(OUT) if f.endswith(".mp3")]
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in mp3s)
print("DONE: generated %d, skipped %d, %.0fs" % (done, skip, time.time() - t0), flush=True)
print("audio/: %.2f MB across %d files" % (tot / 1048576, len(mp3s)), flush=True)
