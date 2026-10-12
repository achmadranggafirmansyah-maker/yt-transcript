// POST /api/transcribe-chunk?offset=SECONDS&lang=id
// Body: potongan audio WAV (maks ~4 MB, batas body Vercel 4.5 MB)
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "GROQ_API_KEY belum diatur di Environment Variables Vercel." });
  }

  const offset = Math.max(0, Number(req.query.offset) || 0);
  const lang = String(req.query.lang || "");
  if (lang && !/^[a-zA-Z]{2,3}$/.test(lang)) {
    return res.status(400).json({ error: "Kode bahasa tidak valid." });
  }

  try {
    const parts = [];
    for await (const c of req) parts.push(c);
    const buf = Buffer.concat(parts);
    if (buf.length < 100) return res.status(400).json({ error: "Audio kosong." });

    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "audio/wav" }), "chunk.wav");
    fd.append("model", "whisper-large-v3-turbo");
    fd.append("response_format", "verbose_json");
    if (lang) fd.append("language", lang);

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: fd,
    });
    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      const map = {
        401: "API key Groq tidak valid.",
        413: "Potongan audio terlalu besar.",
        429: "Batas pemakaian Groq tercapai, coba lagi beberapa menit lagi.",
      };
      const detail = body?.error?.message || "";
      return res
        .status(r.status === 429 ? 429 : 502)
        .json({ error: (map[r.status] || "Gagal mentranskrip audio.") + (detail && !map[r.status] ? ` (${detail})` : "") });
    }

    const items = (body.segments || [])
      .filter((s) => (s.no_speech_prob ?? 0) < 0.9 && String(s.text || "").trim())
      .map((s) => ({ t: Math.floor(offset + (s.start || 0)), text: String(s.text).trim() }));

    return res.status(200).json({ items, lang: body.language || lang || "" });
  } catch (e) {
    return res.status(500).json({ error: "Kesalahan server: " + e.message });
  }
}
