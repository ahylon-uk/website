(() => {
  const API = 'https://api.ahylon.co.uk/contact';   // Cloudflare Worker, see src/worker.js
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const gbp = (n) => '£' + Math.round(n).toLocaleString('en-GB');
  const smooth = reduce ? 'auto' : 'smooth';

  // Old one-page links (ahylon.co.uk/#contact etc.) go to their new pages
  const OLD = { '#services': '/services/', '#work': '/work/', '#process': '/process/', '#faq': '/faq/', '#contact': '/contact/' };
  if ((location.pathname === '/' || location.pathname === '/index.html') && OLD[location.hash]) { location.replace(OLD[location.hash]); return; }

  // Every page opens at the top; a #section link opens at that section
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const jumpTo = (id, behavior = smooth) => {
    const t = id && document.getElementById(id);
    if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 90, behavior });
    return !!t;
  };
  if (!location.hash || !jumpTo(location.hash.slice(1), 'auto')) window.scrollTo(0, 0);
  addEventListener('load', () => { if (location.hash) jumpTo(location.hash.slice(1), 'auto'); });

  // ---------- one-file preview: one page shown at a time, always from the top ----------
  const pages = $$('[data-page]');
  if (pages.length) {
    const show = () => {
      const [pid, anchor] = ((location.hash.slice(1) || 'home').split('?')[0]).split('--');
      const page = pages.find((p) => p.dataset.page === pid);
      if (!page) { jumpTo(pid); return; }
      pages.forEach((p) => { p.hidden = p !== page; });
      $$('.gnav__links a').forEach((a) => {
        const on = a.getAttribute('href') === '#' + (page.dataset.nav || pid);
        on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
      });
      if (page.dataset.title) document.title = page.dataset.title;
      closeMenu();
      window.scrollTo(0, 0);
      if (anchor) requestAnimationFrame(() => jumpTo(anchor, 'auto'));
    };
    addEventListener('hashchange', show);
    queueMicrotask(show);
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const id = a.getAttribute('href').slice(1);
    if (pages.length && pages.some((p) => p.dataset.page === id.split('--')[0])) return;  // preview router handles it
    if (document.getElementById(id)) { e.preventDefault(); jumpTo(id); history.replaceState(null, '', '#' + id); }
  });

  // ---------- nav ----------
  const nav = $('.gnav'), toggle = $('.gnav__toggle'), menu = $('#menu');
  const solid = () => nav && nav.classList.toggle('is-solid', window.scrollY > 40);
  solid(); addEventListener('scroll', solid, { passive: true });
  const outside = () => [$('main'), $('footer')].filter(Boolean);
  // Freeze the page behind the open menu. overflow:hidden on <body> alone doesn't stop
  // touch scrolling (the document scrolls, and iOS ignores it), so pin <body> in place
  // and put the reader back where they were when the menu closes.
  let lockedY = 0;
  function lockScroll(on) {
    const b = document.body.style, h = document.documentElement.style;
    if (on) {
      lockedY = window.scrollY;
      h.overflow = 'hidden';
      Object.assign(b, { position: 'fixed', top: -lockedY + 'px', left: '0', right: '0', width: '100%' });
    } else {
      h.overflow = '';
      Object.assign(b, { position: '', top: '', left: '', right: '', width: '' });
      window.scrollTo({ top: lockedY, behavior: 'instant' });
    }
  }
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('open', open); nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    lockScroll(open);
    outside().forEach((el) => { el.inert = open; });
    if (open) { const f = $('a', menu); if (f) f.focus(); }
  }
  function closeMenu() { if (menu && menu.classList.contains('open')) setMenu(false); }
  if (toggle && menu) {
    toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
    addEventListener('keydown', (e) => {
      if (!menu.classList.contains('open')) return;
      if (e.key === 'Escape') { setMenu(false); toggle.focus(); }
      if (e.key === 'Tab') {   // keep focus inside the open menu
        const items = [toggle, ...$$('a', menu)], i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
  }
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  // ---------- videos ----------
  // hero: autoplay only while on screen, with a pause button; nothing autoplays for reduced motion
  const heroVids = $$('.hero video[autoplay]');
  if (reduce) heroVids.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target; if (reduce || v.dataset.userPaused) return;
    e.isIntersecting ? v.play().catch(() => {}) : v.pause();
  }), { threshold: 0.1 });
  heroVids.forEach((v) => vio.observe(v));
  $$('[data-pause]').forEach((b) => {
    const v = b.closest('.hero').querySelector('video');
    const sync = () => { b.classList.toggle('is-paused', v.paused); b.setAttribute('aria-label', v.paused ? 'Play background video' : 'Pause background video'); };
    b.addEventListener('click', () => { if (v.paused) { delete v.dataset.userPaused; v.play(); } else { v.dataset.userPaused = '1'; v.pause(); } sync(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
  });
  // card videos: play only while hovered or focused (never on their own)
  $$('video[data-hover]').forEach((v) => {
    const host = v.closest('a, button, figure');
    const play = () => { if (!reduce) { v.preload = 'auto'; v.play().catch(() => {}); } };
    const stop = () => v.pause();
    host.addEventListener('mouseenter', play); host.addEventListener('mouseleave', stop);
    host.addEventListener('focusin', play); host.addEventListener('focusout', stop);
  });

  // ---------- reveal on enter, staggered within each section ----------
  const rio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); rio.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('section').forEach((sec) => $$('[data-reveal]', sec).forEach((el, i) => el.style.setProperty('--d', Math.min(i, 5) * 0.08 + 's')));
  $$('[data-reveal]').forEach((el) => reduce ? el.classList.add('in') : rio.observe(el));
  document.addEventListener('focusin', (e) => { const r = e.target.closest('[data-reveal]'); if (r) r.classList.add('in'); });

  // ---------- savings calculator ----------
  // operator-training sliders start folded on phones, open on wider screens
  $$('[data-calc]').forEach((root) => {
    const inp = (id) => $('#' + id, root);
    const v = (id) => Number(inp(id).value);
    const total = $('[data-total]', root), note = $('[data-note]', root), sum = $('[data-sum]', root), send = $('[data-send]', root);
    const tabs = $$('[data-mode-btn]', root);
    const PRESETS = {
      s1: { 'c-shows': 1, 'c-show-cost': 3000 }, s3: { 'c-shows': 3, 'c-show-cost': 4000 }, s6: { 'c-shows': 6, 'c-show-cost': 6000 },
      t3: { 'c-ops': 3, 'c-days': 2, 'c-hours': 2, 'c-rate': 300 }, t6: { 'c-ops': 6, 'c-days': 2, 'c-hours': 2, 'c-rate': 400 }, t12: { 'c-ops': 12, 'c-days': 3, 'c-hours': 3, 'c-rate': 500 },
    };
    const MODES = {
      shows: {
        value: () => v('c-shows') * v('c-show-cost'),
        note: 'estimated saving a year on trade shows',
        sum: () => `${v('c-shows')} ${v('c-shows') === 1 ? 'show' : 'shows'} × ${gbp(v('c-show-cost'))} each`,
        query: () => ({ mode: 'shows', shows: v('c-shows'), showcost: v('c-show-cost') }),
      },
      train: {
        value: () => v('c-ops') * v('c-days') * v('c-hours') * v('c-rate'),
        note: 'estimated saving a year on operator training',
        sum: () => `${v('c-ops')} ${v('c-ops') === 1 ? 'starter' : 'starters'} × ${v('c-days')} ${v('c-days') === 1 ? 'day' : 'days'} × ${v('c-hours')} h × ${gbp(v('c-rate'))} an hour`,
        query: () => ({ mode: 'training', operators: v('c-ops'), days: v('c-days'), hours: v('c-hours'), rate: v('c-rate') }),
      },
    };
    let mode = root.dataset.mode || 'shows', shown = 0, raf = 0;
    const tween = (to) => {
      cancelAnimationFrame(raf);
      if (reduce) { shown = to; total.textContent = Math.round(to).toLocaleString('en-GB'); return; }
      const from = shown, t0 = performance.now();
      const step = (t) => { const p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3); shown = from + (to - from) * e; total.textContent = Math.round(shown).toLocaleString('en-GB'); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    const calc = (animate = true) => {
      $$('input[type=range]', root).forEach((i) => { $(`[data-out="${i.id}"]`, root).textContent = i.dataset.pre + Number(i.value).toLocaleString('en-GB') + i.dataset.unit; });
      const m = MODES[mode], val = m.value();
      note.textContent = m.note; sum.textContent = m.sum();
      send.href = send.getAttribute('href').split('?')[0] + '?' + new URLSearchParams({ estimate: Math.round(val), ...m.query() });
      if (animate) tween(val); else { shown = val; total.textContent = Math.round(val).toLocaleString('en-GB'); }
    };
    const setMode = (next, focus) => {
      mode = next; root.dataset.mode = next;
      tabs.forEach((t) => { const on = t.dataset.modeBtn === next; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
      $$('[data-pane]', root).forEach((p) => { p.hidden = p.dataset.pane !== next; });
      $$('[data-presets]', root).forEach((g) => { g.hidden = g.dataset.presets !== next; });
      calc();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => setMode(t.dataset.modeBtn));
      t.addEventListener('keydown', (e) => {   // arrow keys move between the two tabs
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); setMode(tabs[(i + 1) % tabs.length].dataset.modeBtn, true);
      });
    });
    root.addEventListener('input', (e) => {
      const g = e.target.closest('[data-pane]'); if (g) $$(`[data-presets="${g.dataset.pane}"] .chip`, root).forEach((c) => c.classList.remove('is-on'));
      calc();
    });
    $$('[data-preset]', root).forEach((c) => c.addEventListener('click', () => {
      Object.entries(PRESETS[c.dataset.preset]).forEach(([id, val]) => { inp(id).value = val; });
      $$('.chip', c.parentElement).forEach((x) => x.classList.toggle('is-on', x === c));
      calc();
    }));
    calc(false); total.textContent = '0'; shown = 0;  // fills the text and link; the number counts up when scrolled into view
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { calc(); o.disconnect(); } }, { threshold: 0.3 }).observe(root);
  });

  // ---------- PW-600 wash cycle ----------
  $$('[data-wash]').forEach((root) => {
    const durs = JSON.parse(root.dataset.cycle);
    const steps = $$('.wash__steps li', root), names = steps.map((li) => li.lastChild.textContent);
    const w = (k) => $(`[data-w="${k}"]`, root);
    const start = w('start'), stop = w('stop'), foot = $('.wash__foot', root), msg = w('msg');
    // per step: water %, temp °C, pressure bar, drum spinning, jets on, bubbles
    const T = [[0, 22, 0.4, 0, 0, 0], [92, 45, 1.2, 0, 0, 0], [92, 60, 1.0, 1, 0, 1], [70, 60, 6.2, 1, 1, 0], [8, 52, 0.8, 0, 0, 0], [55, 70, 3.5, 1, 1, 0], [0, 40, 0.4, 0, 0, 0]];
    let i = -1, left = 0, total = 0, timer = null, running = false, visible = false, baskets = 0;
    let st = { lvl: 0, tmp: 18, prs: 0 };
    const ease = (a, b) => a + (b - a) * 0.5;
    const render = () => {
      w('level').textContent = Math.round(st.lvl) + ' %'; w('levelbar').style.width = st.lvl + '%';
      w('temp').textContent = Math.round(st.tmp) + ' °C'; w('tempbar').style.width = (st.tmp / 80 * 100) + '%';
      w('press').textContent = st.prs.toFixed(1) + ' bar'; w('pressbar').style.width = (st.prs / 8 * 100) + '%';
      const h = st.lvl / 100 * 132;
      w('water').setAttribute('y', 146 - h); w('water').setAttribute('height', h);
      w('time').textContent = String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
    };
    const mode = (txt, cls) => { const el = w('mode'); el.textContent = txt; el.className = 'wash__mode ' + (cls || ''); };
    const fx = (k) => { w('drum').classList.toggle('is-spin', !!T[k][3] && !reduce); w('jets').classList.toggle('is-on', !!T[k][4] && !reduce); w('bubbles').classList.toggle('is-on', !!T[k][5] && !reduce); };
    const allFx = (on) => ['drum', 'jets', 'bubbles'].forEach((k) => w(k).classList.toggle(k === 'drum' ? 'is-spin' : 'is-on', on));
    const setStep = (k) => {
      i = k; left = durs[k];
      steps.forEach((li, n) => { li.classList.toggle('is-on', n === k); li.classList.toggle('is-done', n < k); });
      w('stage').textContent = names[k]; fx(k);
      msg.textContent = `Step ${k + 1} of ${durs.length}: ${names[k]}`;
      const tg = T[k]; st = { lvl: ease(st.lvl, tg[0]), tmp: ease(st.tmp, tg[1]), prs: ease(st.prs, tg[2]) };
      render();
    };
    const tick = () => {
      total++; left--;
      const tg = T[i]; st = { lvl: ease(st.lvl, tg[0]), tmp: ease(st.tmp, tg[1]), prs: ease(st.prs, tg[2]) };
      if (left <= 0) { if (i < durs.length - 1) { setStep(i + 1); return; } finish(); return; }
      render();
    };
    const clock = () => { clearInterval(timer); timer = (running && visible) ? setInterval(tick, 1000) : null; };
    const finish = () => {
      running = false; clock(); baskets++;
      const b = w('baskets'); b.textContent = baskets; b.classList.remove('is-pulse'); void b.offsetWidth; b.classList.add('is-pulse');
      steps.forEach((li) => { li.classList.remove('is-on'); li.classList.add('is-done'); });
      allFx(false);
      w('stage').textContent = 'Cycle complete'; msg.textContent = 'Clean basket on the outfeed. Press Start for the next one.';
      mode('DONE', 'is-run'); start.disabled = false; start.textContent = 'Start next basket';
      st = { lvl: 0, tmp: 30, prs: 0 }; render();
    };
    const go = (byUser) => {
      if (running) return;
      if (byUser) msg.setAttribute('aria-live', 'polite');
      foot.classList.remove('is-stop'); total = 0; st = { lvl: 0, tmp: 18, prs: 0 };
      running = true; setStep(0); mode('RUNNING', 'is-run'); start.disabled = true; clock();
    };
    start.addEventListener('click', () => go(true));
    stop.addEventListener('click', () => {
      if (!running) return;
      msg.setAttribute('aria-live', 'polite');
      running = false; clock(); allFx(false);
      const svg = w('svg'); svg.classList.remove('is-shake'); void svg.getBoundingClientRect(); svg.classList.add('is-shake');
      mode('E-STOP', 'is-stop'); foot.classList.add('is-stop');
      w('stage').textContent = 'Emergency stop';
      msg.textContent = `E-stop pressed during ${names[i]}. Pumps off, drum braked. Press Start to reset and run again.`;
      start.disabled = false; start.textContent = 'Reset and start';
    });
    render();
    // runs only while on screen; starts one cycle by itself the first time you reach it
    let first = true;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && first && e.intersectionRatio >= 0.4) { first = false; go(false); }
      clock();
    }, { threshold: [0, 0.4] }).observe(root);
  });

  // ---------- HoneyLine line HMI ----------
  $$('[data-hmi]').forEach((root) => {
    const tiles = $$('.hmi__m', root), N = tiles.length, CAP = 4;
    const k = (name) => $(`[data-k="${name}"]`, root);
    const clockEl = $('.hmi__clock', root), mode = $('[data-mode]', root), foot = $('.hmi__foot', root);
    const LABEL = { running: 'Running', stopped: 'Stopped', blocked: 'Blocked', starved: 'Waiting' };
    let run, buf, count, hist, ticks, upTicks, timer = null;
    const draw = (state) => {
      tiles.forEach((t, i) => {
        t.dataset.s = state[i];
        $('.hmi__state', t).textContent = LABEL[state[i]];
        $('.hmi__count', t).textContent = count[i];
        t.setAttribute('aria-label', `${$('.hmi__name', t).textContent}: ${LABEL[state[i]]}, ${count[i]} cases. Press to ${run[i] ? 'stop' : 'start'}.`);
      });
      const rate = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length * 75 : 0;
      const oee = ticks ? (upTicks / ticks) * 100 : 100;
      k('rate').textContent = rate.toFixed(1); k('ratebar').style.width = Math.min(100, rate / 80 * 100) + '%';
      k('oee').textContent = oee.toFixed(1) + ' %'; k('oeebar').style.width = oee + '%';
      k('cases').textContent = count[N - 1]; k('pallets').textContent = Math.floor(count[N - 1] / 24);
      const down = run.map((r, i) => r ? null : $('.hmi__name', tiles[i]).textContent).filter(Boolean), fault = down.length > 0;
      k('alarm').textContent = fault ? `Alarm: ${down.join(', ')} stopped by operator. Line is backing up.` : 'No active alarms · All guards closed · Air 6.1 bar';
      k('alarm').classList.toggle('is-fault', fault); foot.classList.toggle('is-fault', fault);
      mode.textContent = fault ? 'FAULT' : 'AUTO RUN'; mode.classList.toggle('is-fault', fault);
    };
    const reset = () => { run = Array(N).fill(true); buf = Array(N - 1).fill(2); count = Array(N).fill(0); hist = []; ticks = 0; upTicks = 0; tiles.forEach((t) => t.setAttribute('aria-pressed', 'false')); draw(Array(N).fill('running')); };
    const step = () => {
      const state = Array(N).fill('running'); let made = 0;
      for (let i = N - 1; i >= 0; i--) {
        if (!run[i]) { state[i] = 'stopped'; continue; }
        if (i > 0 && buf[i - 1] <= 0) { state[i] = 'starved'; continue; }
        if (i < N - 1 && buf[i] >= CAP) { state[i] = 'blocked'; continue; }
        if (i > 0) buf[i - 1]--; if (i < N - 1) buf[i]++;
        count[i]++; if (i === N - 1) made++;
      }
      ticks++; if (state.every((s) => s === 'running')) upTicks++;
      hist.push(made); if (hist.length > 30) hist.shift();
      draw(state);
    };
    tiles.forEach((t, i) => t.addEventListener('click', () => { run[i] = !run[i]; t.setAttribute('aria-pressed', String(!run[i])); step(); }));
    $('[data-reset]', root).addEventListener('click', reset);
    reset(); clockEl.textContent = new Date().toLocaleTimeString('en-GB');
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !timer) timer = setInterval(() => { step(); clockEl.textContent = new Date().toLocaleTimeString('en-GB'); }, 800);
      else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
    }).observe(root);
  });

  // ---------- hotspots: click, or arrow keys to move between them ----------
  $$('.spots').forEach((sec) => {
    const card = $('.spots__card', sec), spots = $$('.spot', sec);
    const pick = (b, focus) => {
      const tpl = $(`template[data-spot="${b.dataset.s}"]`, sec);
      spots.forEach((s) => { s.classList.toggle('is-on', s === b); s.setAttribute('aria-pressed', String(s === b)); });
      card.replaceChildren(tpl.content.cloneNode(true));
      card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
      if (focus) b.focus();
    };
    spots.forEach((b, i) => {
      b.addEventListener('click', () => pick(b));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (d) { e.preventDefault(); pick(spots[(i + d + spots.length) % spots.length], true); }
      });
    });
  });

  // ---------- lightbox for stills, with previous/next ----------
  const lb = $('#lightbox');
  let group = [], idx = 0;
  const showShot = () => {
    const s = group[idx]; const im = document.createElement('img');
    im.src = s.dataset.img; im.alt = s.dataset.caption;
    $('.lightbox__body', lb).replaceChildren(im); $('.lightbox__cap', lb).textContent = `${s.dataset.caption}  ·  ${idx + 1} of ${group.length}`;
  };
  if (lb && lb.showModal) {
    const move = (d) => { idx = (idx + d + group.length) % group.length; showShot(); };
    $('.lightbox__close', lb).addEventListener('click', () => lb.close());
    $('.lightbox__prev', lb).addEventListener('click', () => move(-1));
    $('.lightbox__next', lb).addEventListener('click', () => move(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowLeft') move(-1); });
    let x0 = null;
    lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1); x0 = null; });
    lb.addEventListener('close', () => $('.lightbox__body', lb).replaceChildren());
    $$('.shot').forEach((s) => s.addEventListener('click', () => {
      group = $$(`.shot[data-group="${s.dataset.group}"]`); idx = group.indexOf(s);
      showShot(); lb.showModal();
    }));
  }

  // ---------- samples player ----------
  $$('[data-player]').forEach((root) => {
    const v = $('.pl__video', root), screen = $('.pl__screen', root), seek = $('.pl__seek', root), t = $('.pl__t', root);
    const pp = $('.pl__pp', root), big = $('.pl__big', root), items = $$('.pl__item', root);
    const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const sync = () => { screen.classList.toggle('is-playing', !v.paused); pp.setAttribute('aria-label', v.paused ? 'Play' : 'Pause'); };
    const toggle = () => v.paused ? v.play().catch(() => {}) : v.pause();
    pp.addEventListener('click', toggle); big.addEventListener('click', toggle); v.addEventListener('click', toggle);
    v.addEventListener('play', sync); v.addEventListener('pause', sync); v.addEventListener('ended', sync);
    v.addEventListener('timeupdate', () => { if (v.duration) { seek.value = v.currentTime / v.duration * 1000; t.textContent = fmt(v.currentTime); } });
    seek.addEventListener('input', () => { if (v.duration) v.currentTime = seek.value / 1000 * v.duration; });
    $('.pl__fs', root).addEventListener('click', () => { const f = v.requestFullscreen || v.webkitEnterFullscreen; if (f) f.call(v); });
    const choose = (b, play) => {
      items.forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      v.src = b.dataset.src; v.poster = b.dataset.poster; v.setAttribute('aria-label', b.dataset.title + ' film');
      $('.pl__title', root).textContent = b.dataset.title; $('.pl__desc', root).textContent = b.dataset.desc;
      big.setAttribute('aria-label', 'Play ' + b.dataset.title); seek.value = 0; t.textContent = '0:00';
      if (play) v.play().catch(() => {});
      sync();
    };
    items.forEach((b) => b.addEventListener('click', () => { choose(b, true); if (innerWidth < 1024) jumpTo('films'); }));
    // /samples/#reel-pw600 opens with that film selected
    const fromHash = () => {
      const id = location.hash.split('?')[0].split('--').pop().replace('#', '');
      const want = id && items.find((b) => b.id === id);
      if (want) { choose(want, false); requestAnimationFrame(() => jumpTo('films', 'auto')); }
    };
    fromHash(); addEventListener('hashchange', fromHash);
    sync();
  });

  // ---------- customer journey: plays step by step while on screen ----------
  $$('[data-journey]').forEach((root) => {
    const steps = $$('[data-jstep]', root), panels = $$('.jpanel', root);
    let cur = 0, started = false;
    const restart = (el) => { el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); };
    const go = (i) => {
      cur = (i + steps.length) % steps.length;
      steps.forEach((b, n) => { b.classList.toggle('is-done', n < cur); b.setAttribute('aria-selected', String(n === cur)); b.tabIndex = n === cur ? 0 : -1; if (n !== cur) b.classList.remove('is-on'); });
      panels.forEach((p, n) => { p.hidden = n !== cur; if (n !== cur) p.classList.remove('is-on'); });
      restart(steps[cur]); restart(panels[cur]);
    };
    if (reduce) root.classList.add('is-manual');
    root.addEventListener('animationend', (e) => {
      if (e.animationName === 'jfill' && !root.classList.contains('is-manual')) go(cur + 1);
    });
    steps.forEach((b, i) => {
      b.addEventListener('click', () => { root.classList.add('is-manual'); go(i); });
      b.addEventListener('keydown', (e) => {
        const d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
        if (d) { e.preventDefault(); root.classList.add('is-manual'); go(cur + d); steps[cur].focus(); }
      });
    });
    let hover = false, seen = false;
    const pause = () => root.classList.toggle('is-paused', hover || !seen);
    root.addEventListener('mouseenter', () => { hover = true; pause(); });
    root.addEventListener('mouseleave', () => { hover = false; pause(); });
    new IntersectionObserver(([e]) => {
      seen = e.isIntersecting && e.intersectionRatio >= 0.35;
      if (seen && !started) { started = true; go(0); }
      pause();
    }, { threshold: [0, 0.35] }).observe(root);
    steps.forEach((b, n) => { b.tabIndex = n === 0 ? 0 : -1; });
    steps[0].classList.remove('is-on'); panels[0].classList.remove('is-on');
    root.classList.add('is-paused');
  });

  // ---------- full films from YouTube ----------
  // Nothing loads from YouTube until someone presses play. Then the privacy-enhanced
  // player (youtube-nocookie.com) replaces the poster, and when the film ends a
  // "Book a demo" panel appears over it.
  const FILMS = {
    hl: { id: 'aNGicLAuwcw', name: 'HoneyLine', q: 'Want your line filmed like this?' },
    pw: { id: 'wTLwFFbPTOU', name: 'PW-600', q: 'Want your machine filmed like this?' },
  mc: { id: 'xWSQO_PbROE', name: 'Machining Cell', q: 'Want your cell filmed like this?' },
  };
  let ytReady = null;
  const loadYT = () => ytReady || (ytReady = new Promise((ok, fail) => {
    if (window.YT && YT.Player) return ok(YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); ok(YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.onerror = fail;
    document.head.append(s);
    setTimeout(() => fail(new Error('timeout')), 6000);
  }).catch((e) => { ytReady = null; throw e; }));

  const endPanel = (root) => {
    let end = $('.film__end', root);
    if (end) return end;
    end = document.createElement('div');
    end.className = 'film__end'; end.hidden = true;
    end.innerHTML = `<p class="film__q"></p><p class="film__sub">We build films like this from your CAD, along with VR and training.</p>
      <div class="actions"><a class="btn" href="/contact/">Book a demo</a><button class="link film__replay" type="button">Watch again</button></div>`;
    $('.film__q', end).textContent = root.dataset.q || 'Want your machine filmed like this?';
    root.append(end);
    return end;
  };
  const playFilm = (root) => {
    if (root.classList.contains('is-on')) return;
    root.classList.add('is-on', 'is-loading');
    const frame = document.createElement('div');
    frame.className = 'film__frame';
    const slot = document.createElement('div');
    frame.append(slot); root.append(frame);
    const end = endPanel(root);
    const id = root.dataset.film;
    loadYT().then((YT) => {
      const player = new YT.Player(slot, {
        host: 'https://www.youtube-nocookie.com', videoId: id,
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1, cc_load_policy: 0 },
        events: {
          onReady: (e) => { root.classList.remove('is-loading'); e.target.playVideo(); $('iframe', frame).title = (root.dataset.name || '') + ' film'; },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) { end.hidden = false; $('.btn', end).focus({ preventScroll: true }); }
            if (e.data === YT.PlayerState.PLAYING) end.hidden = true;
          },
        },
      });
      root._player = player;
      $('.film__replay', end).onclick = () => { end.hidden = true; player.seekTo(0); player.playVideo(); };
    }).catch(() => {
      // API blocked or slow: fall back to a plain embed (no end panel)
      root.classList.remove('is-loading');
      slot.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${root.dataset.name || ''} film" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    });
  };
  $$('[data-film]').forEach((root) => $('.film__start', root).addEventListener('click', () => playFilm(root)));

  // pop-up player (homepage hero)
  const fbox = $('#filmbox');
  if (fbox) {
    const body = $('.filmbox__body', fbox);
    $$('[data-film-open]').forEach((b) => b.addEventListener('click', () => {
      const f = FILMS[b.dataset.filmOpen]; if (!f) return;
      const root = document.createElement('div');
      root.className = 'film film--box'; root.dataset.film = f.id; root.dataset.name = f.name; root.dataset.q = f.q;
      body.replaceChildren(root);
      fbox.setAttribute('aria-label', f.name + ' film');
      fbox.showModal(); playFilm(root);
    }));
    $('.filmbox__close', fbox).addEventListener('click', () => fbox.close());
    fbox.addEventListener('click', (e) => { if (e.target === fbox) fbox.close(); });
    fbox.addEventListener('close', () => { const r = $('.film', body); if (r && r._player) r._player.destroy(); body.replaceChildren(); });
  }

  // ---------- contact form ----------
  const form = $('#contact-form');
  if (!form) return;
  const status = $('.form__status', form), btn = $('button[type=submit]', form);
  form.elements.t.value = String(Date.now());
  // arriving from the savings calculator: prefill the message
  const prefill = () => {
  const qp = new URLSearchParams(location.search || location.hash.split('?')[1] || '');
  if (qp.get('estimate')) {
    const est = `£${Number(qp.get('estimate')).toLocaleString('en-GB')} a year`, money = (k) => '£' + Number(qp.get(k)).toLocaleString('en-GB');
    form.elements.message.value = qp.get('mode') === 'training'
      ? `Please send me the training estimate with a quote to compare.\n\nMy figures: ${qp.get('operators')} new starters a year, ${qp.get('days')} days each learning on the real line, ${qp.get('hours')} h of production lost per day at ${money('rate')} an hour.\nEstimated saving: ${est}.`
      : qp.get('mode') === 'shows'
        ? `Please send me the trade-show estimate with a quote to compare.\n\nMy figures: ${qp.get('shows')} shows a year at ${money('showcost')} each to take the machine.\nEstimated saving: ${est}.`
        : `Please send me the savings estimate with a quote to compare.\n\nEstimated saving: ${est}.`;
  }
  };
  prefill(); addEventListener('hashchange', prefill);
  const check = (n) => {
    const el = form.elements[n];
    const bad = !el.value.trim() || (n === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()));
    el.classList.toggle('invalid', bad); el.setAttribute('aria-invalid', String(bad));
    return bad;
  };
  ['name', 'email', 'message'].forEach((n) => form.elements[n].addEventListener('input', () => { if (form.elements[n].classList.contains('invalid')) check(n); }));
  const setStatus = (msg, cls) => { status.textContent = msg; status.className = 'form__status ' + (cls || ''); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = ['name', 'email', 'message'].filter(check);
    if (bad.length) { setStatus('Add your name, a valid email and a message.', 'err'); form.elements[bad[0]].focus(); return; }
    btn.disabled = true; btn.textContent = 'Sending…'; setStatus('');
    try {
      const fd = new FormData(form);
      const uses = fd.getAll('for');
      // the contact Worker reads name/company/email/phone/topic/message, so the extra answers travel inside the message
      const extra = [fd.get('show') && `Next show: ${fd.get('show')}`, `They have: ${fd.get('have')}`, uses.length && `For: ${uses.join(', ')}`].filter(Boolean).join('\n');
      const data = { name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), phone: fd.get('phone'), topic: fd.get('topic'), website: fd.get('website'), t: fd.get('t'), message: `${fd.get('message')}\n\n${extra}` };
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || 'The message didn’t send.');
      const to = data.topic === 'tech' ? 'our technical team' : 'our sales team';
      form.classList.add('sent');
      form.innerHTML = '<div class="sent__icon" aria-hidden="true"></div><h3>Demo requested.</h3><p>It’s with ' + to + '. We’ll reply within one working day.</p>';
    } catch (err) {
      setStatus(err.message + ' You can also email sales@ahylon.co.uk.', 'err');
      btn.disabled = false; btn.textContent = 'Request my demo';
    }
  });
})();
