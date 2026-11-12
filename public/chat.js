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

  // ---------- markup: a small original Ahylon robot. Its chest badge is the dotted "O" of the logo,
  // and brand dots flow round it like the logo intro. ----------
  const ring = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2, r = 29;
    return `<circle cx="${(32 + r * Math.cos(a)).toFixed(1)}" cy="${(33 + r * Math.sin(a)).toFixed(1)}" r="${(i % 3 ? 1.1 : 1.7)}"/>`;
  }).join('');
  const badge = [[32,47],[29.5,49],[34.5,49],[32,51],[29.5,53],[34.5,53],[32,55]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join('');
  const robot = (cls = '') => `<svg class="askbot ${cls}" viewBox="0 0 64 64" aria-hidden="true">
      <g class="askbot__ring">${ring}</g>
      <g class="askbot__body">
        <line x1="32" y1="11" x2="32" y2="5" class="askbot__stroke"/><circle cx="32" cy="4.5" r="2.6" class="askbot__tip"/>
        <rect x="12" y="11" width="40" height="29" rx="12" class="askbot__head"/>
        <rect x="9" y="21" width="4" height="9" rx="2" class="askbot__ear"/><rect x="51" y="21" width="4" height="9" rx="2" class="askbot__ear"/>
        <rect x="17" y="17" width="30" height="16" rx="8" class="askbot__visor"/>
        <g class="askbot__eyes"><circle cx="25.5" cy="25" r="3.2"/><circle cx="38.5" cy="25" r="3.2"/></g>
        <path d="M28 29.5q4 2.6 8 0" class="askbot__smile"/>
        <rect x="21" y="42" width="22" height="17" rx="7" class="askbot__head"/>
        <g class="askbot__badge">${badge}</g>
      </g>
    </svg>`;

  // the chat brings its own stylesheet (versioned, so browsers never pair new code with old styles)
  // and stays invisible until that stylesheet has loaded
  const VERSION = '4';
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
        <span class="askai__orb">${robot('askbot--sm')}</span>
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
    if (state.open || !nudge.hidden || busy || document.hidden) return;
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

  if (state.open) setOpen(true, false);
})();
