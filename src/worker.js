// Ahylon website API: POST /chat is the "Ask Ahylon" assistant (src/chat.js); any other POST is the contact form.
// Ahylon contact form API (Cloudflare Worker at https://api.ahylon.co.uk,
// also reachable at the old https://api.virtualine.co.uk and https://api.virtualline.co.uk)
// The website itself is hosted on GitHub Pages. The form POSTs here, and this Worker
// emails the enquiry to the inbox via Cloudflare Email Routing (send_email binding).
//
// Dashboard setup: Worker "virtualline-contact"
//   Settings > Bindings > Send email:  name CONTACT_EMAIL, destination virtualline35@gmail.com
//   Settings > Domains & Routes:      custom domains api.ahylon.co.uk, api.virtualine.co.uk and api.virtualline.co.uk

import { EmailMessage } from "cloudflare:email";
import { handleChat } from "./chat.js";

const TO = "virtualline35@gmail.com";
const FROM = "website@ahylon.co.uk";
const FROM_NAME = "Ahylon Website";
const ALLOWED_ORIGINS = [
  "https://ahylon.co.uk",
  "https://www.ahylon.co.uk",
  "https://virtualine.co.uk",
  "https://www.virtualine.co.uk",
  "https://virtualline.co.uk",
  "https://www.virtualline.co.uk",
  "https://salahshihaibi.github.io",
  "https://ahylon-uk.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
];
const TOPICS = {
  sales: { label: "Sales", alias: "sales@ahylon.co.uk" },
  tech: { label: "Tech", alias: "tech@ahylon.co.uk" },
};

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("origin") || "";
    const cors = {
      "access-control-allow-origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
      vary: "origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, cors);
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, error: "Forbidden." }, 403, cors);
    if (new URL(request.url).pathname === "/chat") {
      // the assistant spends API credit, so only the website may call it
      if (!ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, error: "Forbidden." }, 403, cors);
      return handleChat(request, env, ctx, cors, (m) => sendMail(env, m));
    }
    return handleContact(request, env, cors);
  },
};

async function handleContact(request, env, cors) {
  let data;
  try {
    const type = request.headers.get("content-type") || "";
    if (type.includes("application/json")) data = await request.json();
    else data = Object.fromEntries(await request.formData());
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400, cors);
  }

  const clean = (v, max) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max);
  const oneLine = (v, max) => clean(v, max).replace(/\n/g, " ");

  // Spam traps: hidden field must be empty, form must not be submitted instantly
  if (clean(data.website, 200)) return json({ ok: true }, 200, cors);
  const t = Number(data.t);
  if (t && Date.now() - t < 2500) return json({ ok: true }, 200, cors);

  const name = oneLine(data.name, 100);
  const company = oneLine(data.company, 120);
  const email = oneLine(data.email, 160);
  const phone = oneLine(data.phone, 40);
  const message = clean(data.message, 5000);
  const topic = TOPICS[data.topic] ? data.topic : "sales";

  if (!name || !message) return json({ ok: false, error: "Please add your name and a message." }, 400, cors);
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return json({ ok: false, error: "Please enter a valid email address." }, 400, cors);

  const tp = TOPICS[topic];
  const subject = `[${tp.label}] Website enquiry from ${name}${company ? " (" + company + ")" : ""}`;
  const body = [
    `New ${tp.label.toLowerCase()} enquiry from ahylon.co.uk`,
    `(sent to ${tp.alias})`,
    "",
    `Name:    ${name}`,
    `Company: ${company || "-"}`,
    `Email:   ${email}`,
    `Phone:   ${phone || "-"}`,
    "",
    "Message:",
    message,
    "",
    "---",
    "Just hit Reply to answer this person directly.",
  ].join("\n");

  const raw = buildMime({
    from: `${FROM_NAME} <${FROM}>`,
    to: TO,
    replyTo: `${quoteName(name)} <${email}>`,
    subject,
    body,
  });

  try {
    await env.CONTACT_EMAIL.send(new EmailMessage(FROM, TO, raw));
  } catch (err) {
    console.error("send failed", err && err.message);
    return json({ ok: false, error: "Sorry, we couldn't send your message right now." }, 502, cors);
  }
  return json({ ok: true }, 200, cors);
}

// Used by the chat assistant to pass a lead to the inbox
async function sendMail(env, { subject, body, replyName, replyEmail }) {
  const raw = buildMime({ from: `${FROM_NAME} <${FROM}>`, to: TO, replyTo: `${quoteName(replyName)} <${replyEmail}>`, subject, body });
  await env.CONTACT_EMAIL.send(new EmailMessage(FROM, TO, raw));
}

function buildMime({ from, to, replyTo, subject, body }) {
  const id = `${crypto.randomUUID()}@ahylon.co.uk`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeHeader(subject)}`,
    `Message-ID: <${id}>`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body).replace(/.{1,76}/g, "$&\r\n"),
  ].join("\r\n");
}

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function encodeHeader(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}
function quoteName(n) {
  return /^[\x20-\x7e]*$/.test(n) ? `"${n.replace(/["\\]/g, "")}"` : encodeHeader(n);
}
function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...headers } });
}
