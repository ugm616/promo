// script.js with Stage Zero preloader integration (no user toggle options)
import { alphaVideoSupportPromise } from './alphaDetection.js';

const State = {
  STAGE0: 'stage0_preload',
  STAGE1: 'stage1_intro',
  STAGE2: 'stage2_interactive',
  STAGE3: 'stage3_foreground',
  STAGE4: 'stage4_menu'
};

let currentState = State.STAGE0;
const visitedTiles = new Set();

const tiles = Array.from(document.querySelectorAll('.tile'));
const foregroundVideo = document.getElementById('foreground-video');
const keyedCanvas = document.getElementById('foreground-keyed');
const stage4Menu = document.getElementById('stage4-menu');
const playerOverlay = document.getElementById('player-overlay');
const activeVideo = document.getElementById('active-video');
const closeVideoBtn = document.getElementById('close-video-btn');
const srAnnouncer = document.getElementById('sr-announcer');
const fadeLayer = document.getElementById('fade-layer');
const foregroundContainer = document.getElementById('foreground-container');

// Stage Zero elements
const preloaderEl = document.getElementById('preloader');
const beginBtn = document.getElementById('begin-btn');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const preloaderStatus = document.getElementById('preloader-status');
const appRoot = document.getElementById('app');

let allowAudio = false;
let isZoomPlayback = false;
let chromaKeyFallbackActive = false;
let chromaModule = null;
let alphaOK = false;

// Asset mapping
const FG_ASSETS = {
  intro: {
    alphaWebM: 'assets/videos/foreground_intro_alpha.webm',
    greenScreen: 'assets/videos/foreground_intro_gs.mp4'
  },
  outro: {
    alphaWebM: 'assets/videos/foreground_outro_alpha.webm',
    greenScreen: 'assets/videos/foreground_outro_gs.mp4'
  }
};

const videoSources = {
  loop: i => `assets/videos/loop${i+1}.mp4`,
  full: i => `assets/videos/full${i+1}.mp4`,
  introLibrary: 'assets/videos/intro_full.mp4',
  outroLibrary: 'assets/videos/outro_full.mp4'
};

// --------------------- Stage Zero Preload Logic ---------------------

async function preloadStageZero() {
  preloaderStatus.textContent = 'DETECTING CAPABILITIES...';
  const alphaResult = await alphaVideoSupportPromise;
  alphaOK = alphaResult.alpha;
  if (!alphaOK) {
    console.warn('Alpha video unsupported. Reason:', alphaResult.reason, 'Chroma key fallback will activate.');
  }

  preloaderStatus.textContent = 'COLLECTING ASSETS...';

  // Build asset list (loop videos + foreground intro/outro variant)
  const loopAssets = tiles.map((_, i) => videoSources.loop(i));
  const fgIntroAsset = alphaOK ? FG_ASSETS.intro.alphaWebM : FG_ASSETS.intro.greenScreen;
  const fgOutroAsset = alphaOK ? FG_ASSETS.outro.alphaWebM : FG_ASSETS.outro.greenScreen;

  // NOTE: We intentionally do NOT preload all "full" videos for Stage 2/4 to reduce initial wait.
  // They load on demand; adjust if you truly need them preloaded (would increase user wait).
  const assetsToLoad = [...loopAssets, fgIntroAsset, fgOutroAsset];

  const total = assetsToLoad.length;
  let loaded = 0;

  function updateProgress() {
    const pct = Math.round((loaded / total) * 100);
    progressBar.style.width = pct + '%';
    progressText.textContent = pct + '%';
    if (pct === 100) {
      preloaderStatus.textContent = 'SYSTEM READY';
      showBeginButton();
    } else {
      preloaderStatus.textContent = 'LOADING ASSETS...';
    }
  }

  function loadVideoAsset(url) {
    return new Promise(resolve => {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.src = url;
      // Use loadeddata; canplaythrough may be slow for some codecs.
      const onReady = () => {
        loaded++;
        updateProgress();
        cleanup();
        resolve();
      };
      const onError = () => {
        console.warn('Failed to preload video:', url);
        loaded++;
        updateProgress();
        cleanup();
        resolve();
      };
      function cleanup() {
        v.removeEventListener('loadeddata', onReady);
        v.removeEventListener('error', onError);
      }
      v.addEventListener('loadeddata', onReady);
      v.addEventListener('error', onError);
    });
  }

  updateProgress(); // 0%
  preloaderStatus.textContent = 'LOADING ASSETS...';

  for (const url of assetsToLoad) {
    // eslint-disable-next-line no-await-in-loop
    await loadVideoAsset(url);
  }

  // Prepare loops in actual DOM elements (assign sources now that they're likely cached)
  tiles.forEach(tile => {
    const vid = tile.querySelector('.tile-loop');
    const src = vid.dataset.loopSrc;
    vid.src = src;
    vid.play().catch(()=>{});
  });

  // Prepare chroma key fallback module if needed (defer actual init until phase is set)
  if (!alphaOK) {
    chromaModule = await import('./chromaKeyFallback.js');
  }
}

function showBeginButton() {
  beginBtn.classList.remove('hidden');
  beginBtn.classList.add('flash');
  beginBtn.focus();
  beginBtn.addEventListener('click', handleBegin, { once: true });
}

async function handleBegin() {
  // User gesture obtained
  allowAudio = true;
  appRoot.removeAttribute('aria-hidden');

  // Start Stage 1 foreground
  await startStage1();
  // Fade out preloader
  preloaderEl.classList.add('hidden'); // simple removal; could animate if desired
  announce('Intro video started.');
}

// --------------------- Foreground Helpers ---------------------

function activateForeground() {
  if (chromaKeyFallbackActive) {
    keyedCanvas.classList.add('is-active');
  } else {
    foregroundVideo.classList.add('is-active');
  }
}

function deactivateForeground() {
  foregroundVideo.classList.remove('is-active');
  keyedCanvas.classList.remove('is-active');
}

async function setForegroundPhase(phase) {
  const asset = FG_ASSETS[phase];
  foregroundVideo.pause();
  foregroundVideo.innerHTML = '';

  if (alphaOK) {
    const sWebm = document.createElement('source');
    sWebm.src = asset.alphaWebM;
    sWebm.type = 'video/webm; codecs=vp9';
    foregroundVideo.appendChild(sWebm);
  } else {
    const sGs = document.createElement('source');
    sGs.src = asset.greenScreen;
    sGs.type = 'video/mp4';
    foregroundVideo.appendChild(sGs);
  }
  foregroundVideo.load();
  foregroundVideo.muted = !allowAudio;
  // Start playback
  foregroundVideo.play().catch(()=>{});
}

// --------------------- Stage Transitions ---------------------

async function startStage1() {
  currentState = State.STAGE1;

  // Initialize chroma key fallback *after* we attach sources, but before we show video
  if (!alphaOK && chromaModule && !chromaKeyFallbackActive) {
    chromaKeyFallbackActive = true;
    chromaModule.initChromaKey({
      videoEl: foregroundVideo,
      canvasEl: keyedCanvas,
      keyColor: { r: 0, g: 255, b: 0 }, // Adjust to your exact key color
      similarity: 0.35,
      smoothness: 0.08,
      spill: 0.25
    });
  }

  await setForegroundPhase('intro');
  activateForeground();
}

function transitionToStage2() {
  currentState = State.STAGE2;
  announce('Interactive stage. Select each screen.');
  deactivateForeground();
  setTimeout(() => {
    foregroundVideo.classList.add('hidden');
    if (chromaKeyFallbackActive) keyedCanvas.classList.add('hidden');
  }, 400);
  tiles.forEach(tile => {
    tile.classList.add('interactive');
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
  });
  const first = document.querySelector('.tile.interactive');
  if (first) first.focus();
}

function checkAllVisited() {
  if (visitedTiles.size === tiles.length) {
    setTimeout(() => transitionToStage3(), 600);
  }
}

async function transitionToStage3() {
  currentState = State.STAGE3;
  announce('Stage three starting.');
  tiles.forEach(t => {
    t.classList.remove('interactive');
    t.removeAttribute('role');
    t.removeAttribute('tabindex');
  });
  foregroundVideo.classList.remove('hidden');
  if (chromaKeyFallbackActive) keyedCanvas.classList.remove('hidden');
  await setForegroundPhase('outro');
  activateForeground();
}

function transitionToStage4() {
  fadeLayer.style.opacity = '1';
  setTimeout(() => {
    currentState = State.STAGE4;
    announce('Video library menu.');
    stage4Menu.classList.remove('hidden');
    stage4Menu.setAttribute('aria-hidden', 'false');
    foregroundContainer.classList.add('hidden');
    fadeLayer.style.opacity = '0';
    const firstItem = stage4Menu.querySelector('.menu-item');
    if (firstItem) firstItem.focus();
  }, 600);
}

// --------------------- Interaction / Playback ---------------------

function openVideoModal(src, { zoom=false }) {
  isZoomPlayback = zoom;
  playerOverlay.classList.remove('hidden');
  playerOverlay.setAttribute('aria-hidden', 'false');
  activeVideo.src = src;
  activeVideo.currentTime = 0;
  activeVideo.play().catch(()=>{});
  closeVideoBtn.focus();
}

function closeVideoModal({ returnToMenu=true } = {}) {
  activeVideo.pause();
  activeVideo.removeAttribute('src');
  activeVideo.load();
  playerOverlay.classList.add('hidden');
  playerOverlay.setAttribute('aria-hidden', 'true');
  if (currentState === State.STAGE4 && returnToMenu) {
    const first = stage4Menu.querySelector('.menu-item');
    if (first) first.focus();
  }
  isZoomPlayback = false;
}

function handleTileActivate(tile) {
  if (currentState !== State.STAGE2) return;
  const idx = Number(tile.dataset.index);
  if (Number.isNaN(idx)) return;
  visitedTiles.add(idx);
  const fullSrc = videoSources.full(idx);
  const loopVid = tile.querySelector('video');
  loopVid.pause();
  openVideoModal(fullSrc, { zoom: true });
}

function handleForegroundEnded() {
  if (currentState === State.STAGE1) {
    transitionToStage2();
  } else if (currentState === State.STAGE3) {
    transitionToStage4();
  }
}

function handleActiveVideoEnded() {
  if (isZoomPlayback && currentState === State.STAGE2) {
    closeVideoModal({ returnToMenu:false });
    checkAllVisited();
  } else if (currentState === State.STAGE4) {
    closeVideoModal({ returnToMenu:true });
  }
}

// --------------------- Accessibility / Announce ---------------------

function announce(msg) {
  srAnnouncer.textContent = msg;
  console.log('[Announce]', msg);
}

// --------------------- Event Bindings ---------------------

foregroundVideo.addEventListener('ended', handleForegroundEnded);
activeVideo.addEventListener('ended', handleActiveVideoEnded);

closeVideoBtn.addEventListener('click', () => {
  if (isZoomPlayback && currentState === State.STAGE2) {
    closeVideoModal({ returnToMenu:false });
    checkAllVisited();
  } else {
    closeVideoModal({ returnToMenu:true });
  }
});

playerOverlay.addEventListener('click', e => {
  if (e.target === playerOverlay && currentState === State.STAGE4) {
    closeVideoModal({ returnToMenu:true });
  }
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !playerOverlay.classList.contains('hidden')) {
    closeVideoModal({ returnToMenu: currentState === State.STAGE4 });
  }
});

tiles.forEach(tile => {
  tile.addEventListener('click', () => handleTileActivate(tile));
  tile.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTileActivate(tile);
    }
  });
});

// --------------------- Initialization (Stage Zero) ---------------------

(async function init() {
  await preloadStageZero();
  // Do not proceed to Stage1 until user clicks BEGIN.
})();