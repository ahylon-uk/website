/* Aysh, the "Ask Ahylon" chat assistant.
   Talks to the Cloudflare Worker at https://api.ahylon.co.uk/chat (src/chat.js), which holds the API key.
   The conversation is kept for this browser tab only (sessionStorage), so it follows the visitor between pages. */
(() => {
  const script = document.currentScript;
  const API = (script && script.dataset.api) || 'https://api.ahylon.co.uk/chat';
  const KEY = 'ahylon-chat-v1';
  const MAX_LEN = 1200;
  const STARTERS = ['What do you build?', 'How does VR at a show work?', 'What do you need from me?', 'How much does it cost?'];
  const GREETING = "Hi, I'm Aysh, Ahylon's assistant. Are you OK? Ask me anything about 3D copies of machines, VR at your stand, films or operator training, or tell me about your machine.";
  const NUDGE_KEY = 'ahylon-chat-nudged';
  const NUDGE_DELAY = 6000;      // "are you OK?" after 6 s, once per visit
  const FACT_FIRST = 30000;      // first "did you know?" 30 s after landing
  const FACT_EVERY = 55000;      // then about once a minute
  const FACT_SHOW = 10000;       // each one stays up 10 s (longer while hovered)
  const HIDE_KEY = 'ahylon-chat-hidden';
  const FACT_KEY = 'ahylon-chat-fact';
  // Short facts the robot drops in now and then. ask = what "Tell me more" asks the assistant.
  const FACTS = [
    { t: 'We can take the cost of shipping your machine to engineering shows out of the picture. It travels in a VR headset instead.', ask: 'How does VR at a trade show work?' },
    { t: 'One 3D model of your machine becomes your VR demo, promo film, website content and training tool.', ask: 'What can one model be used for?' },
    { t: 'No CAD? Photos, drawings and measurements are enough for us to start building your machine.', ask: 'What do you need from me to start?' },
    { t: 'New operators can practise on the real control screen before they ever touch the real machine.', ask: 'Tell me about operator training.' },
    { t: 'Our films are rendered straight from the simulation. No film crew, and no moving the machine to film it.', ask: 'Tell me about your promo films.' },
    { t: "Visitors don't need a headset. The same build runs on a laptop with a mouse or a game controller.", ask: 'What do I need at my stand?' },
    { t: 'At your stand there is no install, no power and no water needed for the machine.', ask: 'What do I need at my stand?' },
    { t: 'Buyers can walk round, open up and run a machine that has not been built yet.', ask: 'How does the 3D simulation help sell a machine?' },
    { t: 'Got a confidential machine? We can show the outside and the process only, and keep the inside private.', ask: 'How do you handle confidential machines?' },
    { t: 'You can run our eight-machine HoneyLine packing line in your browser right now.', ask: 'What can I try on the HoneyLine?', href: '/try/' },
  ];

  const store = {
    load() { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } },
    save(s) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {} },
  };
  const state = Object.assign({ open: false, messages: [] }, store.load());
  const persist = () => store.save({ open: state.open, messages: state.messages.slice(-30) });

  // ---------- markup: the robot. Her head is the dotted "O" of the Ahylon logo come to life. ----------
  const BOT_SVG = '<svg class="bot" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><ellipse class="bot-shadow" cx="32" cy="59.5" rx="11" ry="1.6" fill="#1A1D22"/><g class="bot-body"><line class="bot-antenna" x1="32" y1="9.5" x2="32" y2="5" stroke="#9CA0A6" stroke-width="1.2" stroke-linecap="round"/><circle class="bot-antenna-tip" cx="32" cy="4" r="1.7" fill="#C6FF3D"/><g class="bot-voice-rings" fill="none" stroke="#C6FF3D" stroke-width="1.1"><circle class="bot-vr bot-vr1" cx="32" cy="30" r="22.6"/><circle class="bot-vr bot-vr2" cx="32" cy="30" r="22.6"/></g><circle class="bot-core" cx="32" cy="30" r="21.4" fill="#14161A"/><g class="bot-ring" fill="#F4F5F2"><g class="bot-dots bot-d0"><circle cx="37.6" cy="13.8" r="1.09"/><circle cx="41.4" cy="13.8" r="0.93"/><circle cx="35.8" cy="17.0" r="1.36"/><circle cx="39.5" cy="17.0" r="1.26"/><circle cx="30.1" cy="20.3" r="1.52"/><circle cx="33.9" cy="20.3" r="1.52"/><circle cx="50.8" cy="30.0" r="0.93"/><circle cx="48.9" cy="33.2" r="1.09"/><circle cx="17.0" cy="36.5" r="1.16"/><circle cx="47.0" cy="36.5" r="1.16"/><circle cx="15.1" cy="39.7" r="0.83"/><circle cx="41.4" cy="39.7" r="1.36"/><circle cx="45.1" cy="39.7" r="1.16"/><circle cx="35.8" cy="43.0" r="1.36"/><circle cx="39.5" cy="43.0" r="1.26"/><circle cx="33.9" cy="46.2" r="1.16"/><circle cx="37.6" cy="46.2" r="1.09"/><circle cx="32.0" cy="49.5" r="0.83"/></g><g class="bot-dots bot-d1"><circle cx="17.0" cy="17.0" r="0.78"/><circle cx="43.2" cy="17.0" r="1.09"/><circle cx="15.1" cy="20.3" r="0.83"/><circle cx="37.6" cy="20.3" r="1.47"/><circle cx="41.4" cy="20.3" r="1.36"/><circle cx="50.8" cy="36.5" r="0.78"/><circle cx="18.9" cy="39.7" r="1.16"/><circle cx="22.6" cy="39.7" r="1.36"/><circle cx="48.9" cy="39.7" r="0.83"/><circle cx="17.0" cy="43.0" r="0.78"/><circle cx="20.8" cy="43.0" r="1.09"/><circle cx="43.2" cy="43.0" r="1.09"/><circle cx="47.0" cy="43.0" r="0.78"/><circle cx="41.4" cy="46.2" r="0.93"/><circle cx="35.8" cy="49.5" r="0.78"/></g><g class="bot-dots bot-d2"><circle cx="28.2" cy="10.5" r="0.78"/><circle cx="32.0" cy="10.5" r="0.83"/><circle cx="22.6" cy="13.8" r="0.93"/><circle cx="26.4" cy="13.8" r="1.09"/><circle cx="20.8" cy="17.0" r="1.09"/><circle cx="24.5" cy="17.0" r="1.26"/><circle cx="47.0" cy="17.0" r="0.78"/><circle cx="18.9" cy="20.3" r="1.16"/><circle cx="22.6" cy="20.3" r="1.36"/><circle cx="45.1" cy="20.3" r="1.16"/><circle cx="48.9" cy="20.3" r="0.83"/><circle cx="13.2" cy="23.5" r="0.78"/><circle cx="17.0" cy="23.5" r="1.16"/><circle cx="47.0" cy="23.5" r="1.16"/><circle cx="15.1" cy="26.8" r="1.09"/><circle cx="26.4" cy="39.7" r="1.47"/><circle cx="30.1" cy="39.7" r="1.52"/><circle cx="24.5" cy="43.0" r="1.26"/><circle cx="22.6" cy="46.2" r="0.93"/></g><g class="bot-dots bot-d3"><circle cx="35.8" cy="10.5" r="0.78"/><circle cx="30.1" cy="13.8" r="1.16"/><circle cx="33.9" cy="13.8" r="1.16"/><circle cx="28.2" cy="17.0" r="1.36"/><circle cx="32.0" cy="17.0" r="1.39"/><circle cx="26.4" cy="20.3" r="1.47"/><circle cx="50.8" cy="23.5" r="0.78"/><circle cx="48.9" cy="26.8" r="1.09"/><circle cx="13.2" cy="30.0" r="0.93"/><circle cx="17.0" cy="30.0" r="1.26"/><circle cx="47.0" cy="30.0" r="1.26"/><circle cx="15.1" cy="33.2" r="1.09"/><circle cx="13.2" cy="36.5" r="0.78"/><circle cx="33.9" cy="39.7" r="1.52"/><circle cx="37.6" cy="39.7" r="1.47"/><circle cx="28.2" cy="43.0" r="1.36"/><circle cx="32.0" cy="43.0" r="1.39"/><circle cx="26.4" cy="46.2" r="1.09"/><circle cx="30.1" cy="46.2" r="1.16"/><circle cx="28.2" cy="49.5" r="0.78"/></g></g><rect class="bot-visor" x="17.8" y="23.2" width="28.4" height="16.6" rx="8.3" fill="#0E0F12" stroke="#1A1D22" stroke-width="1"/><g class="bot-look"><g class="bot-eyes" fill="#C6FF3D"><ellipse class="bot-eye" cx="26.4" cy="30.6" rx="2.7" ry="3.3"/><ellipse class="bot-eye" cx="37.6" cy="30.6" rx="2.7" ry="3.3"/><path class="bot-lash" d="M24.3 28.6l-1.5-.9M39.7 28.6l1.5-.9" stroke="#C6FF3D" stroke-width=".9" stroke-linecap="round"/></g><rect class="bot-mouth" x="30" y="35.3" width="4" height="1.4" rx=".7" fill="#F4F5F2"/><ellipse class="bot-talk" cx="32" cy="36.2" rx="3.4" ry="2.3" fill="#C6FF3D"/></g></g><g class="bot-hands" fill="#9CA0A6"><circle class="bot-hand bot-hand-l" cx="7.5" cy="39" r="2.5"/><circle class="bot-hand bot-hand-r" cx="56.5" cy="39" r="2.5"/></g></svg>';
  const robot = (cls = '') => `<span class="bot-wrap ${cls}">${BOT_SVG}</span>`;

  // the chat brings its own stylesheet (versioned, so browsers never pair new code with old styles)
  // and stays invisible until that stylesheet has loaded
  const VERSION = '5';
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = `/chat.css?v=${VERSION}`;
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.className = 'askai';
  root.style.visibility = 'hidden';
  const reveal = () => { root.style.visibility = ''; };
  css.addEventListener('load', reveal);
  css.addEventListener('error', () => root.remove());
  root.innerHTML = `
    <div class="askai__nudge" role="status" aria-live="polite" hidden>
      <button class="askai__nudge-x" type="button" aria-label="Dismiss">×</button>
      <p><strong class="askai__nudge-h"></strong><span class="askai__nudge-t"></span></p>
      <div class="askai__nudge-btns"><button type="button" class="askai__nudge-yes"></button><button type="button" class="askai__nudge-no"></button></div>
    </div>
    <button class="askai__hide" type="button" aria-label="Hide Aysh" title="Hide Aysh">×</button>
    <button class="askai__fab" type="button" aria-expanded="false" aria-controls="askai-panel" aria-label="Chat with Aysh, the Ahylon assistant">
      <span class="askai__bot">${robot()}</span><span class="askai__fab-txt">Ask Aysh</span>
    </button>
    <section class="askai__panel" id="askai-panel" role="dialog" aria-modal="false" aria-labelledby="askai-title" hidden>
      <header class="askai__head">
        <span class="askai__orb">${robot()}</span>
        <div><h2 id="askai-title">Aysh</h2><p>Ahylon AI assistant</p></div>
        <button class="askai__icon askai__reset" type="button" aria-label="Start a new chat" title="New chat">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 0 2-4.47M4 3v3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="askai__icon askai__close" type="button" aria-label="Close chat">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </header>
      <div class="askai__log" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="askai__starters"></div>
      <form class="askai__form">
        <label class="sr-only" for="askai-input">Your message</label>
        <textarea id="askai-input" rows="1" maxlength="${MAX_LEN}" placeholder="Ask about your machine…" autocomplete="off"></textarea>
        <button class="askai__send" type="submit" aria-label="Send">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h12M10 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </form>
      <p class="askai__note">AI can make mistakes. For quotes, <a href="/contact/">book a demo</a>. Please don't share confidential details here.</p>
    </section>`;
  document.body.appendChild(root);
  ['keydown', 'keyup', 'keypress'].forEach((t) => root.addEventListener(t, (e) => e.stopPropagation()));

  const $ = (s) => root.querySelector(s);
  const fab = $('.askai__fab'), panel = $('.askai__panel'), log = $('.askai__log'), form = $('.askai__form');
  const input = $('#askai-input'), send = $('.askai__send'), startersBox = $('.askai__starters');
  let busy = false;

  // ---------- safe, tiny markdown: links to our own pages, bold, bullet lists, line breaks ----------
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => {
    if (/^\/(?!\/)[\w\-/#?=&.%]*$/.test(u)) return u;
    if (/^mailto:[^\s@]+@ahylon\.co\.uk$/i.test(u)) return u;
    const m = u.match(/^https:\/\/(www\.)?ahylon\.co\.uk(\/[\w\-/#?=&.%]*)?$/i);
    return m ? (m[2] || '/') : null;
  };
  const inline = (s) => esc(s)
    .replace(/\[([^\]]{1,80})\]\(([^)\s]{1,200})\)/g, (all, t, u) => { const h = safeUrl(u.replace(/&amp;/g, '&')); return h ? `<a href="${esc(h)}">${t}</a>` : t; })
    .replace(/\*\*([^*]{1,200})\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])([a-z]+@ahylon\.co\.uk)\b/gi, '$1<a href="mailto:$2">$2</a>');
  const md = (text) => {
    const out = []; let list = null;
    for (const line of text.split('\n')) {
      const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
      if (li) { (list = list || []).push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
      out.push(line.trim() ? `<p>${inline(line)}</p>` : '');
    }
    if (list) out.push(`<ul>${list.join('')}</ul>`);
    return out.join('');
  };

  // ---------- rendering ----------
  const bubble = (role, text, extra = '') => {
    const el = document.createElement('div');
    el.className = `askai__msg askai__msg--${role} ${extra}`.trim();
    el.innerHTML = role === 'user' ? `<p>${esc(text)}</p>` : md(text);
    log.appendChild(el);
    return el;
  };
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const renderAll = () => {
    log.replaceChildren();
    bubble('assistant', GREETING);
    state.messages.forEach((m) => bubble(m.role, m.content));
    startersBox.replaceChildren();
    if (!state.messages.length) STARTERS.forEach((q) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'askai__chip'; b.textContent = q;
      b.addEventListener('click', () => ask(q));
      startersBox.appendChild(b);
    });
    scroll();
  };

  // ---------- open / close ----------
  const setOpen = (open, focus = true) => {
    state.open = open; persist();
    panel.hidden = !open;
    root.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    if (open) { renderAll(); if (focus) setTimeout(() => input.focus(), 50); }
    else if (focus) fab.focus();
  };
  fab.addEventListener('click', () => setOpen(!state.open));
  $('.askai__close').addEventListener('click', () => setOpen(false));
  $('.askai__reset').addEventListener('click', () => { if (busy) return; state.messages = []; persist(); renderAll(); input.focus(); });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) setOpen(false); });

  // links in replies: our own pages, keep the chat open across the page change
  log.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && a.getAttribute('href').startsWith('/')) persist(); });

  // ---------- input ----------
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

  async function ask(text) {
    text = String(text || '').trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    busy = true; send.disabled = true; startersBox.replaceChildren();
    input.value = ''; grow();
    state.messages.push({ role: 'user', content: text }); persist();
    bubble('user', text);
    talking(true);
    const el = bubble('assistant', '', 'is-typing');
    el.innerHTML = '<span class="askai__dots" aria-label="Typing"><i></i><i></i><i></i></span>';
    scroll();

    let reply = '', failed = '', lead = false;
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: state.messages, page: location.pathname }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Sorry, the assistant isn’t available right now.');
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.t === 'text') { reply += ev.v; el.classList.remove('is-typing'); el.innerHTML = md(reply); scroll(); }
          else if (ev.t === 'lead') lead = true;
          else if (ev.t === 'error') failed = ev.v;
        }
      }
    } catch (err) {
      failed = (err && err.message && !/fetch|network/i.test(err.message)) ? err.message : 'Couldn’t reach the assistant. Check your connection, or email sales@ahylon.co.uk.';
    }

    el.classList.remove('is-typing');
    if (reply) {
      state.messages.push({ role: 'assistant', content: reply });
      el.innerHTML = md(reply);
    }
    if (failed) {
      const f = reply ? bubble('assistant', failed, 'is-error') : el;
      f.classList.add('is-error'); f.innerHTML = md(failed);
      if (!reply) state.messages.pop(); // let them resend the same question
      if (!reply) { input.value = text; grow(); }
    }
    if (lead) bubble('assistant', 'Sent to the team ✓', 'is-sent');
    persist(); scroll();
    talking(false);
    busy = false; send.disabled = false;
    input.focus();
  }

  // ---------- the robot pops up, checks in once per visit, then drops a fact now and then ----------
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };
  const nudge = $('.askai__nudge'), nH = $('.askai__nudge-h'), nT = $('.askai__nudge-t'), nYes = $('.askai__nudge-yes'), nNo = $('.askai__nudge-no');
  let onYes = null, onNo = null, autoHide = 0, hovered = false;

  const hideBubble = () => { clearTimeout(autoHide); nudge.hidden = true; root.classList.remove('is-nudging'); };
  const showBubble = ({ h, t, yes, no, onyes, onno, ttl }) => {
    if (state.open || root.hidden || busy) return false;
    nH.textContent = h; nT.textContent = ' ' + t;
    nYes.textContent = yes; nNo.textContent = no; onYes = onyes; onNo = onno;
    nudge.hidden = false;
    root.classList.remove('is-nudging'); void root.offsetWidth; root.classList.add('is-nudging');
    wave(2400);
    clearTimeout(autoHide);
    if (ttl) { const tick = () => { if (hovered) autoHide = setTimeout(tick, 2000); else hideBubble(); }; autoHide = setTimeout(tick, ttl); }
    return true;
  };
  nudge.addEventListener('mouseenter', () => { hovered = true; });
  nudge.addEventListener('mouseleave', () => { hovered = false; });
  nudge.addEventListener('focusin', () => { hovered = true; });
  nudge.addEventListener('focusout', () => { hovered = false; });
  $('.askai__nudge-x').addEventListener('click', () => { hideBubble(); onNo && onNo(); });
  nNo.addEventListener('click', () => { hideBubble(); onNo && onNo(); });
  nYes.addEventListener('click', () => { hideBubble(); onYes && onYes(); });
  fab.addEventListener('click', hideBubble);

  // the "are you OK?" check-in
  const checkIn = () => {
    if (ss.get(NUDGE_KEY) === '1' || state.messages.length) return;
    if (showBubble({
      h: "Hi, I'm Aysh. Are you OK?", t: 'Need a hand finding anything, or got a question about your machine?',
      yes: 'Yes, help me', no: "I'm fine, thanks",
      onyes: () => setOpen(true), onno: () => {},
    })) ss.set(NUDGE_KEY, '1');
  };

  // "did you know?" facts, a different one each time across the visit
  const onTry = location.pathname.startsWith('/try');
  const nextFact = () => {
    let i = (parseInt(ss.get(FACT_KEY), 10) || 0) % FACTS.length;
    if (onTry && FACTS[i].href === '/try/') i = (i + 1) % FACTS.length;
    ss.set(FACT_KEY, String(i + 1));
    return FACTS[i];
  };
  const dropFact = () => {
    if (state.open || !nudge.hidden || busy || document.hidden || bot.mode !== 'dock') return;
    const f = nextFact();
    showBubble({
      h: 'Aysh: did you know?', t: f.t, ttl: FACT_SHOW,
      yes: f.href ? 'Show me' : 'Tell me more', no: 'Not now',
      onyes: () => { if (f.href) { location.href = f.href; } else { setOpen(true); ask(f.ask); } },
      onno: () => {},
    });
  };

  // close the robot for the rest of this visit
  const hideBot = () => { hideBubble(); setOpen(false, false); root.hidden = true; ss.set(HIDE_KEY, '1'); };
  $('.askai__hide').addEventListener('click', hideBot);

  if (ss.get(HIDE_KEY) === '1') { root.hidden = true; }
  else {
    requestAnimationFrame(() => root.classList.add('is-in'));
    setTimeout(checkIn, NUDGE_DELAY);
    setTimeout(function loop() { dropFact(); setTimeout(loop, FACT_EVERY); }, FACT_FIRST);
  }


  // ---------- her personality ----------
  // Eyes follow the cursor, the nearest hand reaches to grab it, she hides her face when you hover
  // (a bit shy), hops for attention when ignored, and now and then peeks in from the edge of the
  // screen and runs back to her corner if you come near. She gets braver after a few peeks.
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buddy = $('.askai__bot'), fabWrap = buddy.querySelector('.bot-wrap'), headWrap = $('.askai__orb .bot-wrap');
  const parts = (w) => ({ look: w.querySelector('.bot-look'), l: w.querySelector('.bot-hand-l'), r: w.querySelector('.bot-hand-r') });
  const fp = parts(fabWrap);
  const bot = { mode: 'dock', peeks: 0, px: -1, py: -1, lastMove: Date.now(), raf: 0, timers: [] };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); bot.timers.push(t); return t; };

  let talkStart = 0, talkT = 0;
  function talking(on) {
    clearTimeout(talkT);
    if (on) { talkStart = Date.now(); headWrap.classList.add('is-talking'); return; }
    talkT = setTimeout(() => headWrap.classList.remove('is-talking'), Math.max(0, 1500 - (Date.now() - talkStart)));
  }
  function wave(ms) { fabWrap.classList.add('is-waving'); later(() => fabWrap.classList.remove('is-waving'), ms); }

  // eyes and hands follow the pointer
  function track() {
    bot.raf = 0;
    if (bot.px < 0 || root.hidden) return;
    const r = buddy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = bot.px - cx, dy = bot.py - cy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 140);
    if (!root.classList.contains('is-shy')) fp.look.style.translate = `${(dx / d) * 2.4 * k}px ${(dy / d) * 1.8 * k}px`;
    // reach for the cursor when it's close, with the hand on that side
    const reach = !state.open && bot.mode !== 'run' && d < 240 && d > r.width * 0.45;
    const amt = reach ? Math.min(15, 4 + (240 - d) / 12) : 0;
    const near = dx < 0 ? fp.l : fp.r, far = near === fp.l ? fp.r : fp.l;
    near.style.translate = `${(dx / d) * amt}px ${(dy / d) * amt}px`;
    far.style.translate = '0px 0px';
    // out peeking and you come close: shy, so she runs home (unless she's got brave)
    if (bot.mode === 'peek' && d < 170) {
      if (bot.peeks > 3) { bot.mode = 'brave'; wave(1600); later(() => goHome(false), 2600); }
      else runAway();
    }
  }
  addEventListener('pointermove', (e) => {
    bot.px = e.clientX; bot.py = e.clientY; bot.lastMove = Date.now();
    if (!bot.raf) bot.raf = requestAnimationFrame(track);
  }, { passive: true });

  // hover: covers her face, then peeks out at you
  let shyT = 0;
  fab.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || bot.mode !== 'dock') return;
    root.classList.add('is-shy'); fp.look.style.translate = '0px 1.6px';
    clearTimeout(shyT); shyT = setTimeout(() => root.classList.remove('is-shy'), 900);
  });
  fab.addEventListener('pointerleave', () => { clearTimeout(shyT); root.classList.remove('is-shy'); });

  // move her around the screen (translate is relative to her spot on the chat button)
  const dockCentre = () => {
    const r = fab.getBoundingClientRect(), b = 52;
    return [r.left + 4 + b / 2, r.top + r.height / 2 - 9];
  };
  function moveTo(x, y, rot, scale, how) {
    const [cx, cy] = dockCentre();
    buddy.style.transition = how;
    buddy.style.translate = `${Math.round(x - cx)}px ${Math.round(y - cy)}px`;
    buddy.style.rotate = rot + 'deg';
    buddy.style.scale = String(scale);
  }
  function goHome(fast) {
    bot.mode = 'home';
    buddy.style.transition = fast
      ? 'translate .5s cubic-bezier(.6,-.35,.7,1), rotate .3s, scale .4s'
      : 'translate 1.1s cubic-bezier(.45,0,.2,1), rotate .6s, scale .6s';
    buddy.style.translate = '0px 0px'; buddy.style.rotate = '0deg'; buddy.style.scale = '1';
    later(() => { bot.mode = 'dock'; root.classList.remove('is-roaming', 'is-shy'); }, fast ? 520 : 1150);
  }
  function runAway() {
    bot.mode = 'run';
    root.classList.add('is-shy');                 // squints and ducks
    later(() => goHome(true), 220);               // tiny startled pause, then zooms back
  }
  function peek() {
    if (reduceMotion || state.open || root.hidden || document.hidden || busy || bot.mode !== 'dock' || !nudge.hidden) return;
    const vw = innerWidth, vh = innerHeight, size = 52 * 1.6;
    const side = vw < 560 ? 'right' : (Math.random() < .5 ? 'left' : 'right');
    const x = side === 'left' ? size * 0.18 : vw - size * 0.18;
    const y = vh * (0.28 + Math.random() * 0.34);
    bot.mode = 'peek'; bot.peeks++;
    root.classList.add('is-roaming');
    // slip off-screen first, then lean in from the edge
    moveTo(side === 'left' ? -size : vw + size, y, side === 'left' ? 30 : -30, 1.6, 'none');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      moveTo(x, y, side === 'left' ? 22 : -22, 1.6, 'translate .9s cubic-bezier(.2,.9,.3,1.2), rotate .9s');
    }));
    later(() => { if (bot.mode === 'peek') wave(1600); }, 950);
    later(() => { if (bot.mode === 'peek') goHome(false); }, 6200);
  }
  // hop for attention when she's been ignored a while
  function hey() {
    if (reduceMotion || state.open || root.hidden || bot.mode !== 'dock' || !nudge.hidden) return;
    if (Date.now() - bot.lastMove < 12000) return;
    root.classList.remove('is-hey'); void root.offsetWidth; root.classList.add('is-hey');
    later(() => root.classList.remove('is-hey'), 1300);
  }
  if (!reduceMotion && ss.get(HIDE_KEY) !== '1') {
    later(function loop() { peek(); later(loop, 38000 + Math.random() * 32000); }, 16000 + Math.random() * 8000);
    setInterval(hey, 15000);
  }
  // opening the chat brings her home straight away
  fab.addEventListener('click', () => { if (bot.mode !== 'dock') goHome(true); });

  if (state.open) setOpen(true, false);
})();
