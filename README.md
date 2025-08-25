# Alpha Transparency & Fallback Strategy

This project uses native VP9 WebM alpha for the foreground videos (Intro & Outro). If the browser cannot render transparency, it falls back to the original green-screen assets and applies a WebGL chroma key.

## Assets Required

```
assets/videos/
  foreground_intro_alpha.webm
  foreground_intro_gs.mp4
  foreground_outro_alpha.webm
  foreground_outro_gs.mp4
  test_alpha_sample.webm   (small test clip with known transparent area)
```

Supply loop and full videos as previously outlined.

## Alpha Detection

1. Loads `test_alpha_sample.webm`.
2. Draws frame to canvas; samples a known transparent pixel.
3. If alpha channel present → use alpha WebM assets.
4. Else → load green-screen MP4 and invoke WebGL chroma key.

## Producing Alpha WebM (VP9)

```bash
ffmpeg -i foreground_intro_rgba.mov \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 -speed 1 foreground_intro_alpha.webm
```

## Producing Green-Screen Fallback

Use the original (un-keyed) greenscreen capture (no post keying). Name it `foreground_intro_gs.mp4`.

## test_alpha_sample.webm Creation

Create a 32x32 RGBA animation with a transparent 16x16 area at top-left:

Example (using ffmpeg + color sources):
```bash
ffmpeg -f lavfi -i color=color=green@0.0:size=32x32:duration=1 \
  -vf "drawbox=x=0:y=0:w=16:h=16:color=#00000000@0:t=max" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 40 test_alpha_sample.webm
```

(Ensure region (4,4) is fully transparent.)

## Chroma Key Parameters

Adjust in `script.js` (cfg passed to chromaKeyFallback.js):
- keyColor
- similarity (threshold)
- smoothness (feather)
- spill (desaturation near edges)

Tune these with real footage and lock them down.

## Performance Notes

- Alpha WebM path: minimal CPU (pure decode + compositing).
- Fallback key: WebGL GPU shader per frame; acceptable at 1080p on modern devices but monitor mobile Safari performance.
- Consider offering 720p versions if metrics show high mobile usage.
