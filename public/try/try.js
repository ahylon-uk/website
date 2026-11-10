/* /try/ — HoneyLine in the browser.
   Nothing heavy loads until the visitor presses start. */
(() => {
  'use strict';

  // ---------- build files: change names here if the build output changes ----------
  // Each file lists candidate names, tried in order; the first one the server has is used.
  const BUILD = {
    base: '/try/build/',
    loader: ['honeyline.loader.js'],
    data: ['honeyline.data.gz', 'honeyline.data.unityweb', 'honeyline.data.br', 'honeyline.data'],
    framework: ['honeyline.framework.js.gz', 'honeyline.framework.js.unityweb', 'honeyline.framework.js.br', 'honeyline.framework.js'],
    code: ['honeyline.wasm.gz', 'honeyline.wasm.unityweb', 'honeyline.wasm.br', 'honeyline.wasm'],
    streamingAssetsUrl: '/try/build/StreamingAssets',
    approxMB: 60,            // shown on the start button until the real size is known
    companyName: 'Ahylon',
    productName: 'HoneyLine',
    productVersion: '1.0',
  };

  const $ = (id) => document.getElementById(id);
  const frame = $('try-frame'), canvas = $('try-canvas'), cover = $('try-cover');
  const startBtn = $('try-start'), sizeEl = $('try-size'), label = startBtn && startBtn.querySelector('.try__label');
  const load = $('try-load'), status = $('try-status'), bar = $('try-bar'), fill = $('try-bar-fill');
  const err = $('try-err'), errT = $('try-err-t'), errB = $('try-err-b'), retry = $('try-retry');
  const fsBtn = $('try-fs'), exitBtn = $('try-exit');
  const keysDesk = $('try-keys-desk'), keysTouch = $('try-keys-touch');
  if (!frame || !canvas || !startBtn) return;

  // ---------- touch or mouse: right label and controls guide ----------
  const coarse = matchMedia('(pointer: coarse)');
  const applyPointer = () => {
    const t = coarse.matches;
    if (label) label.textContent = t ? 'Tap to start' : 'Click to start';
    if (keysDesk) keysDesk.hidden = t;
    if (keysTouch) keysTouch.hidden = !t;
  };
  applyPointer();
  if (coarse.addEventListener) coarse.addEventListener('change', applyPointer);
  else if (coarse.addListener) coarse.addListener(applyPointer);

  // ---------- find which build files exist (HEAD only, no download) ----------
  const head = async (name) => {
    try {
      const r = await fetch(BUILD.base + name, { method: 'HEAD', cache: 'no-cache' });
      if (!r.ok) return null;
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) return null;           // a 404 page served as 200
      return { name, url: BUILD.base + name, bytes: +r.headers.get('content-length') || 0 };
    } catch (e) { return null; }
  };
  const pick = async (list) => { for (const n of list) { const f = await head(n); if (f) return f; } return null; };
  let probe = null;
  const resolveBuild = () => probe || (probe = Promise.all([pick(BUILD.loader), pick(BUILD.data), pick(BUILD.framework), pick(BUILD.code)])
    .then(([loader, data, framework, code]) => ({ loader, data, framework, code })));

  const showSize = (mb) => { if (sizeEl && mb > 0) sizeEl.textContent = 'About ' + (mb < 10 ? Math.ceil(mb) : Math.round(mb / 5) * 5) + ' MB download'; };
  showSize(BUILD.approxMB);
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(() => resolveBuild().then((b) => {
    const total = [b.data, b.framework, b.code].reduce((s, f) => s + (f ? f.bytes : 0), 0);
    if (b.data && b.code && total > 1e6) showSize(total / 1048576);
  }));

  // ---------- states ----------
  const setProgress = (p) => {
    const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
    fill.style.transform = 'scaleX(' + pct / 100 + ')';
    bar.setAttribute('aria-valuenow', String(pct));
    status.textContent = pct >= 100 ? 'Starting the line…' : 'Loading the line… ' + pct + '%';
  };
  const fail = (title, body, why) => {
    if (why) console.warn('[try]', why);
    load.hidden = true;
    startBtn.parentElement.hidden = true;
    cover.hidden = false;
    cover.classList.add('is-err');
    errT.textContent = title;
    errB.textContent = body;
    err.hidden = false;
    retry.focus();
  };
  retry.addEventListener('click', () => location.reload());

  const hasWebGL2 = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } };
  const addScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('script failed: ' + src));
    document.body.appendChild(s);
  });

  let started = false, instance = null;
  async function start() {
    if (started) return;
    started = true;
    if (!hasWebGL2()) {
      fail('Your browser can’t show 3D here.', 'Try a recent Chrome, Edge, Safari or Firefox, or open this page on a laptop.', 'no WebGL2');
      return;
    }
    startBtn.parentElement.hidden = true;
    load.hidden = false;
    cover.classList.add('is-loading');
    setProgress(0);
    status.textContent = 'Loading the line…';

    const b = await resolveBuild();
    const missing = ['loader', 'data', 'framework', 'code'].filter((k) => !b[k]);
    if (missing.length) {
      fail('The simulation isn’t ready yet.', 'We’re putting the finishing touches to it. Please check back soon, or watch the HoneyLine film for now.', 'missing build files: ' + missing.join(', '));
      return;
    }
    try { await addScript(b.loader.url); } catch (e) {
      fail('The simulation didn’t load.', 'Check your connection and try again.', e);
      return;
    }
    const create = window.createUnityInstance;
    if (typeof create !== 'function') { fail('The simulation didn’t load.', 'Please try again in a moment.', 'loader has no create function'); return; }

    const config = {
      dataUrl: b.data.url,
      frameworkUrl: b.framework.url,
      codeUrl: b.code.url,
      streamingAssetsUrl: BUILD.streamingAssetsUrl,
      companyName: BUILD.companyName,
      productName: BUILD.productName,
      productVersion: BUILD.productVersion,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, coarse.matches ? 1.5 : 2),
      showBanner: (msg, type) => {
        if (type === 'error') fail('Something went wrong.', 'The simulation stopped while loading. Please try again.', msg);
        else console.warn('[try]', msg);
      },
    };
    try {
      instance = await create(canvas, config, setProgress);
      window.hlInstance = instance;
    } catch (e) {
      const m = String(e && e.message || e);
      const mem = /memory|out of memory|allocate/i.test(m);
      fail(mem ? 'Your device ran out of memory.' : 'Something went wrong.',
        mem ? 'Close a few tabs and try again, or open this page on a laptop.' : 'The simulation couldn’t start. Please try again.', e);
      return;
    }
    cover.classList.add('is-done');
    setTimeout(() => { cover.hidden = true; }, 450);
    frame.classList.add('is-live');
    fsBtn.hidden = false;
    canvas.focus({ preventScroll: true });
  }
  startBtn.addEventListener('click', start);

  // ---------- full screen: real full screen where allowed, otherwise fill the window ----------
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
  const setPseudo = (on) => {
    frame.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('try-lock', on);
    exitBtn.hidden = !on;
    if (on) exitBtn.focus(); else fsBtn.focus();
  };
  fsBtn.addEventListener('click', () => {
    if (req) {
      const p = req.call(frame, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => setPseudo(true));
    } else if (instance && instance.SetFullscreen && !coarse.matches) {
      instance.SetFullscreen(1);
    } else {
      setPseudo(true);
    }
    canvas.focus({ preventScroll: true });
  });
  exitBtn.addEventListener('click', () => {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    if (frame.classList.contains('is-full')) setPseudo(false);
  });
  const onFs = () => { const on = fsEl() === frame; frame.classList.toggle('is-fs', on); exitBtn.hidden = !on && !frame.classList.contains('is-full'); };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // the canvas owns its gestures and right-click
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
})();
