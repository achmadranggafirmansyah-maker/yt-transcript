import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { YoutubeTranscript } from "youtube-transcript";

const PORT = process.env.PORT || 3000;
const dir = path.dirname(fileURLToPath(import.meta.url));

const json = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};

const decode = (s) =>
  s.replace(/&amp;#39;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function getTranscript(id) {
  let items;
  try {
    items = await YoutubeTranscript.fetchTranscript(id);
  } catch (e) {
    throw new Error("Transkrip tidak tersedia untuk video ini.");
  }
  let title = "";
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
    );
    if (r.ok) title = (await r.json()).title || "";
  } catch {}
  return {
    id,
    title,
    items: items.map((i) => ({ t: Math.floor(i.offset / 1000), text: decode(i.text) })),
  };
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/transcript") {
      const id = url.searchParams.get("id") || "";
      if (!/^[\w-]{11}$/.test(id)) return json(res, 400, { error: "Link YouTube tidak valid." });
      try {
        return json(res, 200, await getTranscript(id));
      } catch (e) {
        return json(res, 404, { error: e.message });
      }
    }
    try {
      const html = await readFile(path.join(dir, "public", "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(PORT, () => console.log(`Jalan di http://localhost:${PORT}`));
