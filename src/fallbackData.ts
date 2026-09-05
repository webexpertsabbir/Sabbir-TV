import { Channel } from './types';
import { getChannelLogo, isProblematicLogoUrl } from './utils/channelLogos';

export function parseM3U(m3uContent: string): Channel[] {
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

export const fallbackChannels: Channel[] = [
  // --- SPORTS CHANNELS ---
  {
    category: "Sports Channels",
    name: "T Sports HD",
    link: "https://tvsen5.aynaott.com/TnMn5kZz8aLm/index.m3u8",
    logo: "/logos/tsports.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Sports Channels",
    name: "Star Sports HD1",
    link: "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starjalsha.smil/chunklist_b1928000.m3u8",
    logo: "/logos/starsports1.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },

  // --- BANGLADESHI CHANNELS (বাংলাদেশী চ্যানেল) ---
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "NTV HD",
    link: "https://tvsen5.aynaott.com/xV4jEKf3D9zc/index.m3u8",
    logo: "/logos/ntv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "Bangla Vision HD",
    link: "https://tvsen5.aynaott.com/banglavision/index.m3u8",
    logo: "/logos/banglavision.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "RTV HD",
    link: "http://tvsen5.aynascope.net/RtvHD/index.m3u8",
    logo: "/logos/rtv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "ATN Bangla HD",
    link: "http://tvsen5.aynascope.net/atnbangla/index.m3u8",
    logo: "/logos/atnbangla.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "Maasranga TV HD",
    link: "http://tvsen5.aynascope.net/maasrangatv/index.m3u8",
    logo: "/logos/maasranga.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "Boishakhi TV",
    link: "https://boishakhi.sonarbanglatv.com/boishakhi/boishakhitv/index.m3u8",
    logo: "/logos/boishakhi.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "Green TV HD",
    link: "https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/greentv.stream/live-orgin/greentv.stream/playlist.m3u8",
    logo: "/logos/greentv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "Deshi TV HD",
    link: "https://deshitv.deshitv24.net/live/myStream/playlist.m3u8",
    logo: "/logos/deshitv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "Channel S",
    link: "https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/channels.stream/live-orgin/channels.stream/playlist.m3u8",
    logo: "/logos/channels.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "বাংলাদেশী চ্যানেল",
    name: "My TV",
    link: "https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/mytv-up-off.stream/live-orgin/mytv-up-off.stream/playlist.m3u8",
    logo: "/logos/mytv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },

  // --- ENTERTAINMENT CHANNELS ---
  {
    category: "Entertainment Channels",
    name: "Zee Bangla HD",
    link: "http://103.165.93.31:8095/zeeBangla/index.m3u8",
    logo: "/logos/zeebangla.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Entertainment Channels",
    name: "Star Jalsha HD",
    link: "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starjalsha.smil/chunklist_b1928000.m3u8",
    logo: "/logos/starjalsha.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Entertainment Channels",
    name: "Colors Bangla HD",
    link: "http://103.165.93.31:8095/colorsBangla/index.m3u8",
    logo: "/logos/colorsbangla.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Entertainment Channels",
    name: "Sony Aath",
    link: "http://103.165.93.31:8095/sonyAath/index.m3u8",
    logo: "/logos/sonyaath.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Entertainment Channels",
    name: "Colors HD",
    link: "https://d1g8wgjurz8via.cloudfront.net/bpk-tv/ColorsHD/default/ColorsHD.m3u8",
    logo: "/logos/colorshd.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Entertainment Channels",
    name: "Aamar Bangla",
    link: "https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI/amarbanglatv.stream/playlist.m3u8",
    logo: "/logos/aamarbangla.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },

  // --- NEWS CHANNELS ---
  {
    category: "News Channel",
    name: "Ekushey TV News",
    link: "https://ekusheyserver.com/etvlivesn.m3u8",
    logo: "/logos/ekushey.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "News Channel",
    name: "Probashi TV News",
    link: "http://158.69.24.53:8080/probashi_tv/index.m3u8",
    logo: "/logos/probashitv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "News Channel",
    name: "News 21 Bangla TV",
    link: "http://103.190.133.68:1935/news21live/live/playlist.m3u8",
    logo: "/logos/news21.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "News Channel",
    name: "Rajdhani TV",
    link: "https://stream.shariarsuvo.com/hls5/rajdhanicable.m3u8",
    logo: "/logos/rajdhanitv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },

  // --- KIDS CHANNELS ---
  {
    category: "Kids",
    name: "Duronto TV HD",
    link: "https://tvsen6.aynaott.com/6xyZ3N4oHv2KBJdB6W4p/index.m3u8",
    logo: "/logos/duronto.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Kids",
    name: "Disney International HD",
    link: "http://202.70.146.135:8000/play/a04p/index.m3u8",
    logo: "/logos/disney.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Kids",
    name: "Nickelodeon",
    link: "http://103.185.24.134:3001/NICK/index.m3u8",
    logo: "/logos/nickelodeon.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Kids",
    name: "Nick Jr",
    link: "http://103.185.24.134:3001/NICK-JR/index.m3u8",
    logo: "/logos/nickjr.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Kids",
    name: "Sonic",
    link: "http://103.185.24.134:3001/SONIC/index.m3u8",
    logo: "/logos/sonic.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },

  // --- MOVIE CHANNELS ---
  {
    category: "Movie Channels",
    name: "Jalsha Movies HD",
    link: "http://103.165.93.31:8095/jalshaMovies/index.m3u8",
    logo: "/logos/jalshamovies.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Movie Channels",
    name: "Movie Bangla",
    link: "http://alvetv.com/moviebanglatv/8080/index.m3u8",
    logo: "/logos/moviebangla.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },

  // --- INFOTAINMENT & RELIGIOUS ---
  {
    category: "Infotainment",
    name: "BBC Earth HD",
    link: "https://amg00793-amg00793c6-xumo-us-2669.playouts.now.amagi.tv/BBCStudios-BBCEarthA-hls/playlist.m3u8",
    logo: "/logos/bbcearth.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Infotainment",
    name: "Discovery Bangla HD",
    link: "http://103.165.93.31:8095/discovery/index.m3u8",
    logo: "/logos/discovery.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Infotainment",
    name: "Animal Planet HD",
    link: "http://103.165.93.31:8095/animalPlanet/index.m3u8",
    logo: "/logos/animalplanet.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Infotainment",
    name: "Nat Geo Wild HD",
    link: "http://88.212.15.29/live/test_ngw/playlist.m3u8",
    logo: "/logos/natgeowild.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Infotainment",
    name: "National Geographic HD",
    link: "http://103.165.93.31:8095/nationalGeographic/index.m3u8",
    logo: "/logos/natgeo.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Infotainment",
    name: "Madani Channel Bangla",
    link: "https://streaming.madanichannel.tv/static/streaming-playlists/hls/d3e49b76-ac06-4689-a641-9200445b647f/master.m3u8",
    logo: "/logos/madani.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  },
  {
    category: "Infotainment",
    name: "Azan TV",
    link: "https://dbcanada.sonarbanglatv.com/azantv/atv/index.m3u8",
    logo: "/logos/azantv.svg",
    cookie: "",
    user_agent: "okhttp/4.11.0"
  }
];

export async function fetchChannelsClientResilient(forceFallback = false): Promise<{
  channels: Channel[];
  source: string;
  updatedOn: string;
}> {
  if (forceFallback) {
    return {
      channels: fallbackChannels,
      source: "Verified Fallback List",
      updatedOn: "Direct Static"
    };
  }

  // 1. Try local backend /api/channels (Express server or Netlify Function)
  try {
    const res = await fetch("/api/channels");
    const contentType = res.headers.get("content-type") || "";
    // If it's OK and returned JSON (not SPA HTML from 404 fallback)
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && Array.isArray(data.channels) && data.channels.length > 0) {
        return {
          channels: data.channels,
          source: data.source || "server-proxy",
          updatedOn: data.updatedOn || "Live Server"
        };
      }
    }
  } catch (err) {
    console.warn("Backend /api/channels not available (Static host or Netlify):", err);
  }

  // 2. Direct client-side fetch from GitHub Raw API (CORS enabled by GitHub)
  try {
    console.log("Attempting direct client-side fetch from GitHub Smart playlist...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const ghRes = await fetch(
      "https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_NS_Player.m3u?t=" + Date.now(),
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (ghRes.ok) {
      const text = await ghRes.text();
      const parsed = parseM3U(text);
      if (parsed.length > 0) {
        return {
          channels: parsed,
          source: "Direct GitHub Playlist (Client Mode)",
          updatedOn: "Auto-synced from GitHub"
        };
      }
    }
  } catch (ghErr) {
    console.warn("Direct GitHub fetch skipped or timed out:", ghErr);
  }

  // 3. Guaranteed offline / static fallback channels
  return {
    channels: fallbackChannels,
    source: "Verified Fallback Feeds",
    updatedOn: "Active Feeds"
  };
}
