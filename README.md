# Multi‑Stage Video Experience

An interactive, staged video interface with automatic alpha‑video detection (VP9 WebM with transparency) and a chroma‑key WebGL fallback. A retro “Stage Zero” preloader gates the first user gesture and enables audio/autoplay compliance.

## Stage Overview

| Stage | ID (Code)           | Description |
|-------|---------------------|-------------|
| 0     | `stage0_preload`    | Preloader screen (90’s terminal style). Loads critical assets (loops + intro/outro foreground). Shows a progress bar. When 100%, a flashing BEGIN button appears. |
| 1     | `stage1_intro`      | Fullscreen foreground intro video (alpha WebM or chroma‑keyed fallback) layered over looping background grid. |
| 2     | `stage2_interactive`| Background grid tiles become interactive. Each tile opens its associated “full” video (modal). After viewing all six, auto‑advance. |
| 3     | `stage3_foreground` | Foreground outro video (alpha or keyed) plays. |
| 4     | `stage4_menu`       | Video library menu (Intro, 1–6, Outro) with on‑demand playback modal. |

Audio is enabled automatically after the user clicks BEGIN (first gesture). No other runtime toggles are exposed to the user.

---

## File / Directory Structure

```
.
├── index.html
├── styles.css
├── script.js
├── alphaDetection.js
├── chromaKeyFallback.js
├── assets/
│   ├── videos/
│   │   ├── foreground_intro_alpha.webm
│   │   ├── foreground_intro_gs.mp4
│   │   ├── foreground_outro_alpha.webm
│   │   ├── foreground_outro_gs.mp4
│   │   ├── test_alpha_sample.webm
│   │   ├── loop1.mp4
│   │   ├── loop2.mp4
│   │   ├── loop3.mp4
│   │   ├── loop4.mp4
│   │   ├── loop5.mp4
│   │   ├── loop6.mp4
│   │   ├── full1.mp4
│   │   ├── full2.mp4
│   │   ├── full3.mp4
│   │   ├── full4.mp4
│   │   ├── full5.mp4
│   │   ├── full6.mp4
│   │   ├── intro_full.mp4
│   │   └── outro_full.mp4
│   ├── posters/
│   │   ├── foreground.jpg
│   │   ├── loop1.jpg
│   │   ├── loop2.jpg
│   │   ├── loop3.jpg
│   │   ├── loop4.jpg
│   │   ├── loop5.jpg
│   │   └── loop6.jpg
│   ├── captions/          (optional)
│   │   ├── foreground_intro.vtt
│   │   ├── foreground_outro.vtt
│   │   └── full1.vtt ...
│   └── fonts/             (optional)
├── README.md
└── (LICENSE / analytics / service-worker optional)
```

### Required Code Files
- `index.html`
- `styles.css`
- `script.js`
- `alphaDetection.js`
- `chromaKeyFallback.js`

### Required Video Assets
- Foreground alpha + green‑screen fallback: `foreground_intro_alpha.webm`, `foreground_intro_gs.mp4`, `foreground_outro_alpha.webm`, `foreground_outro_gs.mp4`
- Alpha probe: `test_alpha_sample.webm`
- Grid loops: `loop1.mp4` … `loop6.mp4`
- Full zoom videos: `full1.mp4` … `full6.mp4`
- Stage 4 library: `intro_full.mp4`, `outro_full.mp4`

### Posters (Recommended)
- `foreground.jpg`
- `loop1.jpg` … `loop6.jpg`

---

## Alpha Detection & Fallback

1. `alphaDetection.js` loads `test_alpha_sample.webm`.
2. Draws a frame to canvas; samples a pixel expected to be transparent.
3. If pixel alpha ≈ 0 → native VP9 alpha supported; use `*_alpha.webm` files.
4. Else → load green screen MP4s and activate `chromaKeyFallback.js` (WebGL shader generates transparency).

No user override exists; the process is automatic.

---

## Chroma Key Fallback (WebGL)

Shader converts RGB to YCbCr, measures chroma distance to the key color, produces a soft matte with feather (`similarity`/`smoothness`) and basic spill suppression.

Adjust these constants inside the `initChromaKey` call (currently):
```
similarity: 0.35
smoothness: 0.08
spill: 0.25
keyColor: { r: 0, g: 255, b: 0 }
```
If your green screen isn’t pure #00FF00, update `keyColor`.

---

## Performance Considerations

| Item | Notes |
|------|-------|
| Foreground Intro/Outro | Short 1080p; OK for VP9 alpha decode. |
| Chroma Key Fallback | GPU fragment shader per frame; acceptable at 1080p on modern devices. |
| Loops | Autoplay muted; preloaded at Stage Zero to avoid in‑stage stalls. |
| Full Videos | Loaded on demand (not preloaded to minimize initial wait). |

If mobile GPU performance dips, consider:
- Supplying 720p variants of alpha videos.
- Reducing canvas internal resolution in fallback (downscale video upload with an intermediate canvas, then scale up).

---

## Accessibility

- Live region (`#sr-announcer`) announces stage transitions.
- Focus management:
  - BEGIN button focused when ready.
  - First tile focused entering Stage 2.
  - First menu item focused entering Stage 4.
- Keyboard:
  - Tiles receive `role="button"` + `tabindex` when interactive.
  - Space/Enter activate tiles.
  - ESC closes modal playback.
- Captions (optional): Add `<track>` elements when VTT files are provided.

Example snippet (when adding captions):
```html
<video id="active-video" class="active-video" playsinline controls>
  <track kind="captions" src="assets/captions/full1.vtt" srclang="en" label="English" default>
</video>
```

---

## Placeholder / Dummy Asset Generation

Use `ffmpeg` to create lightweight test content.

### Grid Loop Placeholder (4s, distinct shade)
```bash
ffmpeg -f lavfi -i color=c=#202020:size=1920x1080:rate=30 -t 4 \
  -c:v libx264 -pix_fmt yuv420p loop1.mp4
```
Repeat with different `c=#303030`, `#404040`, etc.

### Full Video Placeholder (10s with timecode)
```bash
ffmpeg -f lavfi -i color=c=#101010:size=1920x1080:rate=30 \
  -vf "drawtext=text='FULL1 %{pts\\:hms}':x=40:y=80:fontsize=80:fontcolor=white" \
  -t 10 -c:v libx264 -pix_fmt yuv420p full1.mp4
```

### Alpha Foreground Placeholder (simple RGBA WebM)
```bash
ffmpeg -f lavfi -i color=c=black@0.0:size=1920x1080:rate=30 \
  -vf "drawbox=x=200:y='200+mod(n,300)':w=400:h=400:color=white@1.0:t=fill" \
  -t 5 -c:v libvpx-vp9 -pix_fmt yuva420p foreground_intro_alpha.webm
```

### Green Screen Fallback Placeholder
```bash
ffmpeg -f lavfi -i color=c=0x00FF00:size=1920x1080:rate=30 \
  -vf "drawbox=x='100+mod(n,400)':y=300:w=200:h=200:color=white@1.0:t=fill" \
  -t 5 -c:v libx264 -pix_fmt yuv420p foreground_intro_gs.mp4
```

### Tiny Alpha Probe (32×32)
```bash
ffmpeg -f lavfi -i color=c=black@0.0:size=32x32:rate=1 -vf \
"drawbox=x=0:y=0:w=16:h=16:color=#00FF00@0.0:t=fill" \
-t 1 -c:v libvpx-vp9 -pix_fmt yuva420p -frames:v 1 test_alpha_sample.webm
```

### Poster Frames
```bash
ffmpeg -f lavfi -i color=c=#222:size=640x360 -frames:v 1 loop1.jpg
```

---

## Optional Bulk Placeholder Script

Create `generate_placeholders.sh` (example):

```bash
#!/usr/bin/env bash
set -e

mkdir -p assets/videos assets/posters

# Loops
for i in {1..6}; do
  shade=$(printf "#%02x%02x%02x" $((0x10 + i*0x10)) $((0x10 + i*0x10)) $((0x10 + i*0x10)))
  ffmpeg -y -f lavfi -i color=c=${shade}:size=1920x1080:rate=30 -t 4 \
    -c:v libx264 -pix_fmt yuv420p assets/videos/loop${i}.mp4
  ffmpeg -y -f lavfi -i color=c=${shade}:size=640x360 -frames:v 1 assets/posters/loop${i}.jpg
done

# Full videos
for i in {1..6}; do
  ffmpeg -y -f lavfi -i color=c=#101010:size=1920x1080:rate=30 \
    -vf "drawtext=text='FULL${i} %{pts\\:hms}':x=40:y=80:fontsize=80:fontcolor=white" \
    -t 10 -c:v libx264 -pix_fmt yuv420p assets/videos/full${i}.mp4
done

# Intro/Outro library
for name in intro outro; do
  ffmpeg -y -f lavfi -i color=c=#181818:size=1920x1080:rate=30 \
    -vf "drawtext=text='${name^^} %{pts\\:hms}':x=60:y=90:fontsize=80:fontcolor=white" \
    -t 8 -c:v libx264 -pix_fmt yuv420p assets/videos/${name}_full.mp4
done

# Foreground alpha + green screen placeholders
ffmpeg -y -f lavfi -i color=c=black@0.0:size=1920x1080:rate=30 \
  -vf "drawbox=x=200:y='200+mod(n,300)':w=400:h=400:color=white@1.0:t=fill" \
  -t 5 -c:v libvpx-vp9 -pix_fmt yuva420p assets/videos/foreground_intro_alpha.webm

ffmpeg -y -f lavfi -i color=c=0x00FF00:size=1920x1080:rate=30 \
  -vf "drawbox=x='100+mod(n,400)':y=300:w=200:h=200:color=white@1.0:t=fill" \
  -t 5 -c:v libx264 -pix_fmt yuv420p assets/videos/foreground_intro_gs.mp4

# Duplicate for outro (or modify animation)
cp assets/videos/foreground_intro_alpha.webm assets/videos/foreground_outro_alpha.webm
cp assets/videos/foreground_intro_gs.mp4 assets/videos/foreground_outro_gs.mp4

# Alpha probe
ffmpeg -y -f lavfi -i color=c=black@0.0:size=32x32:rate=1 \
  -vf "drawbox=x=0:y=0:w=16:h=16:color=#00FF00@0.0:t=fill" \
  -t 1 -c:v libvpx-vp9 -pix_fmt yuva420p -frames:v 1 assets/videos/test_alpha_sample.webm

# Foreground poster
ffmpeg -y -f lavfi -i color=c=#111:size=1280x720 -frames:v 1 assets/posters/foreground.jpg

echo "Placeholder asset generation complete."
```

Make executable:
```bash
chmod +x generate_placeholders.sh
./generate_placeholders.sh
```

---

## Encoding Foreground (Production)

Starting from a ProRes 4444 (alpha) master:

```bash
ffmpeg -i foreground_intro_prores4444.mov \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 -speed 1 \
  assets/videos/foreground_intro_alpha.webm
```

Tune `-crf` (lower = better quality / bigger file). Use `yuva420p` for widest compatibility; upgrade to `yuva422p` or `yuva444p` only after testing.

---

## Adding Captions (Optional)

1. Create VTT file (e.g. `assets/captions/foreground_intro.vtt`).
2. Add `<track>` elements to `<video>` tags (foreground & modal) if you want live captions. (Currently omitted.)

---

## Future Ideas / Extensions

- Service Worker for caching loop videos (careful with storage quotas).
- Analytics hooks (dispatch custom events on stage transitions).
- Progressive enhancement for AV1 alpha when broadly supported.
- Adaptive resolution selection (720p fallback on low DPR or slow networks).
- External configuration JSON for stage timings and asset mapping.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| BEGIN never appears | Missing or failing video loads | Check console/network; verify asset paths. |
| Foreground opaque on Safari | VP9 alpha unsupported | Ensure fallback GS MP4 present and chroma key code executed (console should log). |
| Green halo edges | Key color mismatch / lighting | Adjust `keyColor`, `similarity`, and re-export better keyed RGBA if possible. |
| High CPU on mobile | WebGL chroma key + 1080p | Provide 720p fallback or lower similarity complexity. |
| Audio muted after BEGIN | Autoplay policy not satisfied | Confirm user actually clicked BEGIN (first gesture). |

---

## License

Add a LICENSE file appropriate to your project (MIT, Apache-2.0, etc.) if distributing.

---

## Maintenance Tips

- Re-encode alpha videos if file size exceeds acceptable thresholds (>15–20MB for short intros).
- Periodically re-test alpha detection on new Safari / iOS releases.
- Keep chroma key fallback parameters version-controlled.

---

If you need a variant README for contributors or deployment instructions (e.g., GitHub Pages / CDN guidance), let me know and I can append a Deployment section.
