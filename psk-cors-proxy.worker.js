/*
 * psk-cors-proxy — Cloudflare Worker
 * ------------------------------------------------------------------
 * PSK Reporter (retrieve.pskreporter.info) does NOT send CORS headers,
 * so a browser cannot fetch it directly. This tiny Worker fetches the
 * URL server-side and re-serves it with Access-Control-Allow-Origin: *.
 *
 * DEPLOY (free tier is enough):
 *   1. Create a Worker at https://dash.cloudflare.com  (Workers & Pages)
 *   2. Paste this whole file as the Worker code, Deploy.
 *   3. Copy your Worker URL, e.g. https://psk-proxy.<you>.workers.dev
 *   4. In HamRadio Commander -> PSK Reporter Spots -> "CORS proxy URL"
 *      paste:   https://psk-proxy.<you>.workers.dev/?url={url}
 *
 * The app replaces {url} with the (already URL-encoded) PSK query.
 *
 * Security: this allows ONLY retrieve.pskreporter.info to be proxied,
 * so it can't be abused as an open proxy.
 */
export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const target = new URL(request.url).searchParams.get("url");
    if (!target) return new Response("missing ?url=", { status: 400, headers: cors });

    let decoded;
    try { decoded = decodeURIComponent(target); } catch { decoded = target; }

    // allowlist: only PSK Reporter
    if (!/^https?:\/\/retrieve\.pskreporter\.info\//i.test(decoded)) {
      return new Response("only retrieve.pskreporter.info is allowed", { status: 403, headers: cors });
    }

    try {
      const upstream = await fetch(decoded, {
        headers: { "User-Agent": "HamRadioCommander/3.0 (CORS proxy)" },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...cors, "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "max-age=60" },
      });
    } catch (e) {
      return new Response("upstream error: " + e.message, { status: 502, headers: cors });
    }
  },
};
