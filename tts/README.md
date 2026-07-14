# Narration (text-to-speech) build

Penny's "Read to me" narration is **pre-generated** into MP3 files with the
open-source **[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)** voice
(Apache-2.0). This is what makes the narration sound natural and identical on
**every browser including Safari**, work **offline**, and cost nothing at
runtime — no cloud TTS, no API key, no backend. The device's built-in speech
engine is only a fallback (e.g. for text containing a child's typed-in name).

Voice: `af_heart` (warm US female). MP3s live in [`../audio/`](../audio) named
`<hash>.mp3`, where `<hash>` is a hash of the cleaned on-screen text. The app
hashes the text it is about to read and plays the matching clip if present.

## Regenerating

You only need this if you change narrated lesson/glossary text.

```bash
# 1. one-time environment (Kokoro needs its model + a spaCy model)
python3 -m venv ttsenv
./ttsenv/bin/pip install kokoro soundfile lameenc
# spaCy's en_core_web_sm is normally fetched from GitHub; if that's blocked,
# grab it from Hugging Face and rename to a pip-valid version:
curl -sL "https://huggingface.co/spacy/en_core_web_sm/resolve/main/en_core_web_sm-any-py3-none-any.whl" -o ecws.whl
cp ecws.whl en_core_web_sm-3.7.1-py3-none-any.whl
./ttsenv/bin/pip install ./en_core_web_sm-3.7.1-py3-none-any.whl

# 2. extract the exact narration strings from app.js (single source of truth)
node tts/extract.mjs        # -> tts/narration.json + audio-manifest.js

# 3. render the clips (incremental; skips ones that already exist)
./ttsenv/bin/python tts/generate.py   # -> audio/<hash>.mp3
```

`extract.mjs` reads the strings straight out of `app.js`, and its `clean()` +
`hashStr()` are byte-for-byte the same as the app's, so a clip is always found
by hashing the same on-screen text — the audio can never silently drift from
what's displayed. Delete a clip and re-run `generate.py` to re-render just it.
