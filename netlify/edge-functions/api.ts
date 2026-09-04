import { fallbackChannels, parseM3U } from "../../src/fallbackData.ts";

function rewriteM3U8Content(
  text: string,
  targetUrl: string,
  cookie: string,
  ua: string,
  proxyPrefix: string = "/api/stream"
): string {
  const urlObj = new URL(targetUrl);
  const origin = urlObj.origin;
  const basePath = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

  const lines = text.split(/\r?\n/);
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("#")) {
      return trimmed.replace(/URI="([^"]+)"/g, (_, p1) => {
        let resolved = p1;
        if (p1.startsWith("//")) resolved = urlObj.protocol + p1;
        else if (p1.startsWith("/")) resolved = origin + p1;
        else if (!p1.startsWith("http://") && !p1.startsWith("https://")) resolved = basePath + p1;

        if (urlObj.search) {
          const query = urlObj.search.startsWith("?") ? urlObj.search.substring(1) : urlObj.search;
          if (resolved.includes("?")) {
            if (!resolved.includes("edge-cache-token=") && query.includes("edge-cache-token=")) {
              resolved += "&" + query;
            }
          } else {
            resolved += "?" + query;
          }
        }

        const proxyUri = `${proxyPrefix}?url=${encodeURIComponent(resolved)}&cookie=${encodeURIComponent(cookie)}&ua=${encodeURIComponent(ua)}`;
        return `URI="${proxyUri}"`;
      });
    }

    let resolved = trimmed;
    if (trimmed.startsWith("//")) resolved = urlObj.protocol + trimmed;
    else if (trimmed.startsWith("/")) resolved = origin + trimmed;
    else if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) resolved = basePath + trimmed;

    if (urlObj.search) {
      const query = urlObj.search.startsWith("?") ? urlObj.search.substring(1) : urlObj.search;
      if (resolved.includes("?")) {
        if (!resolved.includes("edge-cache-token=") && query.includes("edge-cache-token=")) {
          resolved += "&" + query;
        }
      } else {
        resolved += "?" + query;
      }
    }

    return `${proxyPrefix}?url=${encodeURIComponent(resolved)}&cookie=${encodeURIComponent(cookie)}&ua=${encodeURIComponent(ua)}`;
  });

  return rewritten.join("\n");
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  // CHANNELS
  if (pathname.includes("channels") || url.searchParams.get("action") === "channels") {
    if (url.searchParams.get("source") === "fallback") {
      return new Response(JSON.stringify({
        source: "fallback",
        channels: fallbackChannels,
        updatedOn: "Verified Active Streams"
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(
        "https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_NS_Player.m3u?t=" + Date.now(),
        {
          headers: { "User-Agent": "ToffeeLiveProxy-Edge" },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        const parsed = parseM3U(text);
        if (parsed.length > 0) {
          return new Response(JSON.stringify({
            source: "github-raw",
            channels: parsed,
            updatedOn: "Auto-synced from GitHub"
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }
    } catch (_) {}

    return new Response(JSON.stringify({
      source: "fallback",
      channels: fallbackChannels,
      updatedOn: "Verified Active Streams"
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // STREAM PROXY
  if (pathname.includes("stream") || url.searchParams.get("action") === "stream" || url.searchParams.get("url")) {
    const rawUrl = url.searchParams.get("url");
    const cookie = url.searchParams.get("cookie") || "";
    const ua = url.searchParams.get("ua") || "okhttp/4.11.0";

    if (!rawUrl) {
      return new Response("Missing 'url' query parameter", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      const targetUrl = decodeURIComponent(rawUrl);
      const reqHeaders: Record<string, string> = {
        "User-Agent": ua,
        "Origin": "https://toffeelive.com",
        "Referer": "https://toffeelive.com/"
      };

      if (cookie) {
        reqHeaders["Cookie"] = cookie.startsWith("Edge-Cache-Cookie=") || !cookie.startsWith("URLPrefix=")
          ? cookie
          : `Edge-Cache-Cookie=${cookie}`;
      }

      try {
        const parsed = new URL(targetUrl);
        reqHeaders["Host"] = parsed.host;
      } catch (_) {}

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const upstream = await fetch(targetUrl, {
        headers: reqHeaders,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!upstream.ok) {
        return new Response(`Upstream error: ${upstream.status}`, {
          status: upstream.status,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }

      const contentType = upstream.headers.get("content-type") || "";
      const isM3u8 = targetUrl.toLowerCase().includes(".m3u8") ||
        contentType.includes("mpegurl") ||
        (contentType.includes("application/octet-stream") && targetUrl.includes(".m3u8"));

      if (isM3u8) {
        const text = await upstream.text();
        const rewritten = rewriteM3U8Content(text, targetUrl, cookie, ua);

        return new Response(rewritten, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // Stream raw binary chunks directly via Web Streams!
      return new Response(upstream.body, {
        headers: {
          "Content-Type": contentType || "video/MP2T",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (err: any) {
      return new Response(`Stream error: ${err?.message || err}`, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  }

  return new Response(JSON.stringify({ status: "ok", message: "Toffee Edge Proxy Active" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
};
