import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fallbackChannels } from "./serverFallbackData";
import { Channel } from "./src/types";
import { getChannelLogo, isProblematicLogoUrl } from "./src/utils/channelLogos";

// Helper function to parse M3U/JSON files
function parseM3U(m3uContent: string): Channel[] {
  const trimmed = m3uContent.trim();
  
  // Handshake handling: If the remote returns a JSON list, parse as JSON
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any, idx: number) => {
          const ch: Channel = {
            name: item.name || `Channel #${idx + 1}`,
            logo: item.logo || "",
            category: item.category || "LIVE",
            link: item.link || "",
            cookie: item.cookie || "",
            user_agent: item.user_agent || "okhttp/4.11.0"
          };
          if (!ch.logo || isProblematicLogoUrl(ch.logo)) {
            ch.logo = getChannelLogo(ch);
          }
          return ch;
        }).filter(ch => ch.link);
      }
    } catch (e) {
      console.error("Failed to parse remote JSON, falling back to M3U parser:", e);
    }
  }

  const lines = m3uContent.split(/\r?\n/);
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/) || line.match(/logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/) || line.match(/category="([^"]+)"/);
      
      const commaIndex = line.lastIndexOf(",");
      const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : "Unknown Channel";

      currentChannel = {
        name,
        logo: logoMatch ? logoMatch[1] : "",
        category: groupMatch ? groupMatch[1] : "LIVE",
        link: "",
        cookie: "",
        user_agent: "okhttp/4.11.0"
      };
    } else if (line.startsWith("#EXTVLCOPT:")) {
      if (currentChannel) {
        if (line.includes("http-user-agent=")) {
          currentChannel.user_agent = line.split("http-user-agent=")[1].trim();
        } else if (line.includes("http-cookie=")) {
          currentChannel.cookie = line.split("http-cookie=")[1].trim();
        }
      }
    } else if (line.startsWith("http://") || line.startsWith("https://")) {
      if (currentChannel) {
        currentChannel.link = line;
        if (!currentChannel.logo || isProblematicLogoUrl(currentChannel.logo)) {
          currentChannel.logo = getChannelLogo(currentChannel as Channel);
        }
        channels.push(currentChannel as Channel);
        currentChannel = null;
      }
    }
  }
  return channels;
}

// Helper for resilient fetch with automatic retries for transient DNS/connection resets
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delayMs = 300): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error("Fetch failed after retries");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URLencoded middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API endpoints to fetch live Smart channel manifest
  app.get("/api/channels", async (req, res) => {
    // If client explicitly requests fallback data, return immediately
    if (req.query.source === "fallback" || req.query.fallback === "true") {
      console.log("Serving verified serverFallbackData on explicit client request.");
      return res.json({
        source: "serverFallbackData",
        channels: fallbackChannels,
        updatedOn: "Verified Active Streams"
      });
    }

    let m3uText = "";
    let fetchedFrom = "";

    // Attempt 1: GitHub REST API (returns Base64, completely live, bypasses CDN caching entirely)
    try {
      console.log("Checking remote playlist via GitHub API...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const apiResponse = await fetch(
        "https://api.github.com/repos/BINOD-XD/Toffee-Auto-Update-Playlist/contents/toffee_NS_Player.m3u",
        {
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SmartLiveProxy-Applet (Express Node)"
          },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (apiResponse.ok) {
        const data = await apiResponse.json() as any;
        if (data && data.content && data.encoding === "base64") {
          const base64Str = data.content.replace(/\s/g, "");
          m3uText = Buffer.from(base64Str, "base64").toString("utf-8");
          fetchedFrom = "github-api";
          console.log("Successfully fetched fresh real-time playlist via GitHub Contents API.");
        }
      }
    } catch (apiErr: any) {
      // Remote API unavailable
    }

    // Attempt 2: GitHub Raw file with fast timeout
    if (!m3uText) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const rawUrl = `https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_NS_Player.m3u?t=${Date.now()}`;
        const rawResponse = await fetch(rawUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Cache-Control": "no-cache"
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (rawResponse.ok) {
          m3uText = await rawResponse.text();
          fetchedFrom = "github-raw";
        }
      } catch (rawErr: any) {
        // Raw fetch failed
      }
    }

    let updatedOn = "";
    if (m3uText) {
      try {
        const uRes = await fetch("https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_channel_data.json?t=" + Date.now(), {
          headers: { "User-Agent": "SmartLiveProxy-Applet (Express Node)" }
        });
        if (uRes.ok) {
          const uJson = await uRes.json() as any;
          if (uJson && uJson.updated_on) {
            updatedOn = uJson.updated_on;
          }
        }
      } catch (e) {}

      const parsedChannels = parseM3U(m3uText);
      if (parsedChannels.length > 0) {
        console.log(`Successfully loaded ${parsedChannels.length} channels from ${fetchedFrom}.`);
        return res.json({
          source: fetchedFrom,
          channels: parsedChannels,
          updatedOn: updatedOn || "Just Now"
        });
      }
    }

    console.log("Serving verified serverFallbackData (28 active live streams).");
    res.json({
      source: "serverFallbackData",
      channels: fallbackChannels,
      updatedOn: "Verified Active Streams"
    });
  });

  // Proxy streaming endpoint to inject required headers (cookie, user-agent)
  app.get("/api/stream", async (req, res) => {
    const rawUrl = req.query.url as string;
    const cookie = req.query.cookie as string;
    const ua = req.query.ua as string;

    if (!rawUrl) {
      return res.status(400).send("Missing stream 'url' parameter.");
    }

    try {
      const targetUrl = decodeURIComponent(rawUrl);
      const headers: Record<string, string> = {
        "User-Agent": ua || "okhttp/4.11.0",
      };

      if (cookie) {
        headers["Cookie"] = cookie;
        // Also add Edge Cache cookie prefix if appropriate
        if (!cookie.startsWith("Edge-Cache-Cookie=") && cookie.startsWith("URLPrefix=")) {
          headers["Cookie"] = `Edge-Cache-Cookie=${cookie}`;
        }
      }

      // Add simple host header if playing from Toffee Live CDN to avoid blocks
      try {
        const parsedTarget = new URL(targetUrl);
        headers["Host"] = parsedTarget.host;
      } catch (e) {}

      const fetchResponse = await fetchWithRetry(targetUrl, { headers });

      if (!fetchResponse.ok) {
        console.warn(`Upstream responded with error: ${fetchResponse.status} for URL: ${targetUrl}`);
        return res.status(fetchResponse.status).send(`Upstream request failed with status: ${fetchResponse.status}`);
      }

      const contentType = fetchResponse.headers.get("content-type") || "";

      // Check if this is an M3U8 playlist which needs inner URI rewriting
      if (
        targetUrl.toLowerCase().includes(".m3u8") ||
        contentType.includes("mpegurl") ||
        contentType.includes("mpegURL") ||
        contentType.includes("application/octet-stream") && targetUrl.includes(".m3u8")
      ) {
        let m3u8Text = await fetchResponse.text();
        const urlObj = new URL(targetUrl);
        const origin = urlObj.origin;
        const basePath = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

        const lines = m3u8Text.split(/\r?\n/);
        const rewrittenLines = lines.map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return "";

          // Rewrite lines that are tags with nested URI property (e.g. #EXT-X-KEY)
          if (trimmed.startsWith("#")) {
            let modified = trimmed;
            const uriRegex = /URI="([^"]+)"/g;
            modified = modified.replace(uriRegex, (match, p1) => {
              let resolved = p1;
              if (p1.startsWith("//")) {
                resolved = urlObj.protocol + p1;
              } else if (p1.startsWith("/")) {
                resolved = origin + p1;
              } else if (!p1.startsWith("http://") && !p1.startsWith("https://")) {
                resolved = basePath + p1;
              }
              // Propagate parental query parameters (such as edge-cache-token) to keep chunks authenticated
              if (urlObj.search) {
                const tokenParams = urlObj.search.startsWith("?") ? urlObj.search.substring(1) : urlObj.search;
                if (resolved.includes("?")) {
                  if (!resolved.includes("edge-cache-token=")) {
                    resolved += "&" + tokenParams;
                  }
                } else {
                  resolved += "?" + tokenParams;
                }
              }
              const proxyUri = `/api/stream?url=${encodeURIComponent(resolved)}&cookie=${encodeURIComponent(cookie || "")}&ua=${encodeURIComponent(ua || "")}`;
              return `URI="${proxyUri}"`;
            });
            return modified;
          }

          // Rewrite direct stream segment links
          let resolved = trimmed;
          if (trimmed.startsWith("//")) {
            resolved = urlObj.protocol + trimmed;
          } else if (trimmed.startsWith("/")) {
            resolved = origin + trimmed;
          } else if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            resolved = basePath + trimmed;
          }

          // Propagate parental query parameters (such as edge-cache-token) to keep chunks authenticated
          if (urlObj.search) {
            const tokenParams = urlObj.search.startsWith("?") ? urlObj.search.substring(1) : urlObj.search;
            if (resolved.includes("?")) {
              if (!resolved.includes("edge-cache-token=")) {
                resolved += "&" + tokenParams;
              }
            } else {
              resolved += "?" + tokenParams;
            }
          }

          return `/api/stream?url=${encodeURIComponent(resolved)}&cookie=${encodeURIComponent(cookie || "")}&ua=${encodeURIComponent(ua || "")}`;
        });

        // Set HLS m3u8 content header
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.send(rewrittenLines.join("\n"));
      }

      // If it is binary stream (.ts segment or AES decryption keys)
      let streamContentType = contentType || "video/MP2T";
      if (targetUrl.toLowerCase().includes(".ts")) {
        streamContentType = "video/MP2T";
      }
      res.setHeader("Content-Type", streamContentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache chunks to prevent redundant requests
      res.setHeader("Access-Control-Allow-Origin", "*");

      const contentLength = fetchResponse.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      if (fetchResponse.body) {
        const reader = fetchResponse.body.getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(Buffer.from(value));
          await pump();
        };
        await pump().catch((err) => {
          console.error("Binary proxy streaming error:", err);
          res.end();
        });
      } else {
        res.end();
      }

    } catch (error: any) {
      console.warn("Proxy endpoint network warning:", error?.message || error);
      if (!res.headersSent) {
        res.status(502).send(`Stream chunk unavailable or connection reset: ${error?.message || error}`);
      }
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development mode with Vite HMR middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
