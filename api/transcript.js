// Vercel Serverless Function: GET /api/transcript?id=VIDEO_ID
export default async function handler(req, res) {
  const id = String(req.query.id || "");
  if (!/^[\w-]{11}$/.test(id)) {
    return res.status(400).json({ error: "Link YouTube tidak valid." });
  }

  const key = process.env.SUPADATA_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "SUPADATA_API_KEY belum diatur di Environment Variables Vercel.",
    });
  }

  try {
    const r = await fetch(
      "https://api.supadata.ai/v1/youtube/transcript?url=" +
        encodeURIComponent("https://www.youtube.com/watch?v=" + id),
      { headers: { "x-api-key": key } }
    );
    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      const detail = body.message || body.error || "";
      const map = {
        401: "API key Supadata tidak valid.",
        402: "Kuota Supadata habis.",
        429: "Terlalu banyak permintaan, coba lagi sebentar.",
        404: "Video ini tidak punya transkrip.",
      };
      return res
        .status(r.status === 404 ? 404 : 502)
        .json({ error: (map[r.status] || "Gagal mengambil transkrip.") + (detail ? ` (${detail})` : "") });
    }

    // Supadata mengembalikan content berupa array {text, offset(ms), duration}
    if (!Array.isArray(body.content) || !body.content.length) {
      return res.status(404).json({ error: "Transkrip kosong untuk video ini." });
    }
    const items = body.content.map((c) => ({
      t: Math.floor((c.offset || 0) / 1000),
      text: String(c.text || "").replace(/\s+/g, " ").trim(),
    }));

    let title = "";
    try {
      const o = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
      );
      if (o.ok) title = (await o.json()).title || "";
    } catch {}

    res.setHeader("Cache-Control", "s-maxage=3600");
    return res.status(200).json({ id, title, items });
  } catch (e) {
    return res.status(500).json({ error: "Kesalahan server: " + e.message });
  }
}
