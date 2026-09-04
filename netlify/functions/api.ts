import { fallbackChannels, parseM3U } from "../../src/fallbackData";

// Netlify Function (Standard Web Fetch Request/Response supported natively in Netlify)
export default async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Handle CORS preflight
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

  // 1. CHANNELS ENDPOINT
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
          headers: { "User-Agent": "ToffeeLiveProxy-Netlify" },
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
            updatedOn: "Auto-synced"
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }
    } catch (e) {
      console.warn("Netlify function channels fetch error:", e);
    }

    // Fallback response
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

  // 2. STREAM PROXY ENDPOINT
  if (pathname.includes("stream") || url.searchParams.get("action") === "stream") {
    const rawUrl = url.searchParams.get("url");
    const cookie = url.searchParams.get("cookie") || "";
    const ua = url.searchParams.get("ua") || "okhttp/4.11.0";

    if (!rawUrl) {
      return new Response("Missing 'url' query parameter.", { status: 400 });
    }

    try {
      const targetUrl = decodeURIComponent(rawUrl);
      const reqHeaders: Record<string, string> = {
        "User-Agent": ua
      };
      if (cookie) {
        reqHeaders["Cookie"] = cookie;
        if (!cookie.startsWith("Edge-Cache-Cookie=") && cookie.startsWith("URLPrefix=")) {
          reqHeaders["Cookie"] = `Edge-Cache-Cookie=${cookie}`;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        contentType.includes("application/octet-stream") && targetUrl.includes(".m3u8");

      if (isM3u8) {
        const text = await upstream.text();
        const urlObj = new URL(targetUrl);
        const origin = urlObj.origin;
        const basePath = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

        const lines = text.split(/\r?\n/);
        const rewritten = lines.map(line => {
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
                resolved += resolved.includes("?") ? `&${query}` : `?${query}`;
              }

              const proxyUri = `/api/stream?url=${encodeURIComponent(resolved)}&cookie=${encodeURIComponent(cookie)}&ua=${encodeURIComponent(ua)}`;
              return `URI="${proxyUri}"`;
            });
          }

          let resolved = trimmed;
          if (trimmed.startsWith("//")) resolved = urlObj.protocol + trimmed;
          else if (trimmed.startsWith("/")) resolved = origin + trimmed;
          else if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) resolved = basePath + trimmed;

          if (urlObj.search) {
            const query = urlObj.search.startsWith("?") ? urlObj.search.substring(1) : urlObj.search;
            resolved += resolved.includes("?") ? `&${query}` : `?${query}`;
          }

          return `/api/stream?url=${encodeURIComponent(resolved)}&cookie=${encodeURIComponent(cookie)}&ua=${encodeURIComponent(ua)}`;
        });

        return new Response(rewritten.join("\n"), {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // Stream binary chunks (.ts segment)
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

  return new Response(JSON.stringify({ status: "ok", message: "Netlify API function active" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
};

// Also export AWS-style handler for older Netlify runtime compatibility
export const handler = async (event: any) => {
  const path = event.path || "";
  const query = event.queryStringParameters || {};
  const isChannels = path.includes("channels") || query.action === "channels";
  
  if (isChannels) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        source: "fallback",
        channels: fallbackChannels,
        updatedOn: "Verified Active Streams"
      })
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({ status: "ok" })
  };
};
