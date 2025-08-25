// alphaDetection.js
// Detect true RGBA video support and expose result via a global promise.

export const alphaVideoSupportPromise = (async () => {
  // Small test asset with known transparent area (top-left pixel fully transparent).
  // Provide: assets/videos/test_alpha_sample.webm
  const testSrc = 'assets/videos/test_alpha_sample.webm';
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.src = testSrc;
  // Quick rejection if browser cannot even attempt WebM.
  if (!v.canPlayType('video/webm')) {
    return { alpha: false, reason: 'no-webm' };
  }
  try {
    await v.play().catch(()=>{ /* ignore autoplay block */ });
    await new Promise(res => {
      if (v.readyState >= 2) return res();
      v.addEventListener('loadeddata', () => res(), { once: true });
      setTimeout(res, 2500); // timeout safety
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(v.videoWidth || 64, 64);
    canvas.height = Math.min(v.videoHeight || 64, 64);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const pixel = ctx.getImageData(4, 4, 1, 1).data; // sample an area known to be transparent
    const alpha = pixel[3]; // 0..255

    return { alpha: alpha < 10, reason: alpha < 10 ? 'ok' : 'opaque-pixel' };
  } catch (e) {
    return { alpha: false, reason: 'exception:' + e.message };
  }
})();