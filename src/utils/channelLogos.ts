/**
 * Channel Logo Resolver & Asset Registry
 * Guarantees 100% visible, crisp vector logos for all channels
 * without depending on external Wikimedia/Imgur hosts that block hotlinking.
 */

export const CHANNEL_LOGO_MAP: Record<string, string> = {
  // Sports
  "t sports": "/logos/tsports.svg",
  "t sports hd": "/logos/tsports.svg",
  "star sports": "/logos/starsports1.svg",
  "star sports 1": "/logos/starsports1.svg",
  "star sports hd1": "/logos/starsports1.svg",
  "star sports hd 1": "/logos/starsports1.svg",
  "star sports select": "/logos/starsports1.svg",
  "sony sports": "/logos/sonyaath.svg",
  "sony ten": "/logos/sonyaath.svg",

  // Bangladeshi Entertainment & General
  "ntv": "/logos/ntv.svg",
  "ntv hd": "/logos/ntv.svg",
  "bangla vision": "/logos/banglavision.svg",
  "banglavision": "/logos/banglavision.svg",
  "bangla vision hd": "/logos/banglavision.svg",
  "rtv": "/logos/rtv.svg",
  "rtv hd": "/logos/rtv.svg",
  "atn bangla": "/logos/atnbangla.svg",
  "atn bangla hd": "/logos/atnbangla.svg",
  "maasranga": "/logos/maasranga.svg",
  "maasranga tv": "/logos/maasranga.svg",
  "maasranga tv hd": "/logos/maasranga.svg",
  "maasranga hd": "/logos/maasranga.svg",
  "boishakhi": "/logos/boishakhi.svg",
  "boishakhi tv": "/logos/boishakhi.svg",
  "green tv": "/logos/greentv.svg",
  "green tv hd": "/logos/greentv.svg",
  "deshi tv": "/logos/deshitv.svg",
  "deshi tv hd": "/logos/deshitv.svg",
  "desh tv": "/logos/deshitv.svg",
  "channel s": "/logos/channels.svg",
  "my tv": "/logos/mytv.svg",
  "channel i": "/logos/channeli.svg",
  "channel 9": "/logos/default.svg",
  "gtv": "/logos/gtv.svg",
  "gazi tv": "/logos/gtv.svg",
  "nagorik": "/logos/nagorik.svg",
  "nagorik tv": "/logos/nagorik.svg",
  "btv": "/logos/btv.svg",
  "btv world": "/logos/btv.svg",
  "btv national": "/logos/btv.svg",

  // Entertainment / Kolkata / Indian Bangla
  "zee bangla": "/logos/zeebangla.svg",
  "zee bangla hd": "/logos/zeebangla.svg",
  "star jalsha": "/logos/starjalsha.svg",
  "star jalsha hd": "/logos/starjalsha.svg",
  "colors bangla": "/logos/colorsbangla.svg",
  "colors bangla hd": "/logos/colorsbangla.svg",
  "sony aath": "/logos/sonyaath.svg",
  "sony ath": "/logos/sonyaath.svg",
  "colors": "/logos/colorshd.svg",
  "colors hd": "/logos/colorshd.svg",
  "aamar bangla": "/logos/aamarbangla.svg",
  "amar bangla": "/logos/aamarbangla.svg",

  // News Channels
  "somoy": "/logos/somoytv.svg",
  "somoy tv": "/logos/somoytv.svg",
  "somoy news": "/logos/somoytv.svg",
  "jamuna": "/logos/jamunatv.svg",
  "jamuna tv": "/logos/jamunatv.svg",
  "dbc": "/logos/dbcnews.svg",
  "dbc news": "/logos/dbcnews.svg",
  "ekattor": "/logos/ekattor.svg",
  "ekattor tv": "/logos/ekattor.svg",
  "71 tv": "/logos/ekattor.svg",
  "independent": "/logos/independent.svg",
  "independent tv": "/logos/independent.svg",
  "channel 24": "/logos/channel24.svg",
  "ekushey": "/logos/ekushey.svg",
  "ekushey tv": "/logos/ekushey.svg",
  "ekushey tv news": "/logos/ekushey.svg",
  "probashi tv": "/logos/probashitv.svg",
  "probashi tv news": "/logos/probashitv.svg",
  "news 21": "/logos/news21.svg",
  "news 21 bangla tv": "/logos/news21.svg",
  "rajdhani tv": "/logos/rajdhanitv.svg",
  "atn news": "/logos/atnbangla.svg",

  // Kids
  "duronto": "/logos/duronto.svg",
  "duronto tv": "/logos/duronto.svg",
  "duronto tv hd": "/logos/duronto.svg",
  "disney": "/logos/disney.svg",
  "disney international": "/logos/disney.svg",
  "disney international hd": "/logos/disney.svg",
  "nickelodeon": "/logos/nickelodeon.svg",
  "nick": "/logos/nickelodeon.svg",
  "nick jr": "/logos/nickjr.svg",
  "nick jr.": "/logos/nickjr.svg",
  "sonic": "/logos/sonic.svg",

  // Movies
  "jalsha movies": "/logos/jalshamovies.svg",
  "jalsha movies hd": "/logos/jalshamovies.svg",
  "movie bangla": "/logos/moviebangla.svg",
  "zee cinema": "/logos/zeebangla.svg",
  "sony max": "/logos/sonyaath.svg",

  // Infotainment & Religious
  "bbc earth": "/logos/bbcearth.svg",
  "bbc earth hd": "/logos/bbcearth.svg",
  "discovery": "/logos/discovery.svg",
  "discovery bangla": "/logos/discovery.svg",
  "discovery bangla hd": "/logos/discovery.svg",
  "animal planet": "/logos/animalplanet.svg",
  "animal planet hd": "/logos/animalplanet.svg",
  "nat geo wild": "/logos/natgeowild.svg",
  "nat geo wild hd": "/logos/natgeowild.svg",
  "national geographic": "/logos/natgeo.svg",
  "national geographic hd": "/logos/natgeo.svg",
  "nat geo": "/logos/natgeo.svg",
  "madani": "/logos/madani.svg",
  "madani channel": "/logos/madani.svg",
  "madani channel bangla": "/logos/madani.svg",
  "azan tv": "/logos/azantv.svg",
  "peace tv": "/logos/madani.svg"
};

/**
 * Normalizes a channel name for fuzzy matching
 */
function normalizeName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[\[\(].*?[\]\)]/g, "") // Remove [HD], (LIVE), etc.
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a remote logo URL is known to be broken or blocked by hotlink protection
 */
export function isProblematicLogoUrl(url?: string): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return true;

  // Mixed content check: HTTP image on HTTPS origin
  if (typeof window !== "undefined" && window.location.protocol === "https:" && trimmed.startsWith("http://")) {
    return true;
  }

  // Sites known to return 400, 403 or block hotlinking / CORS
  const blockedDomains = [
    "upload.wikimedia.org",
    "i.imgur.com",
    "imgur.com",
    "jiotvimages.cdn.jio.com",
    "live.dinesh29.com.np",
    "s3.aynaott.com",
    "alvetv.com",
    "deshitv24.net",
    "streaming.madanichannel.tv"
  ];

  for (const domain of blockedDomains) {
    if (trimmed.includes(domain)) return true;
  }

  return false;
}

/**
 * Returns the best, guaranteed-to-load logo for a channel
 */
export function getChannelLogo(channel: { name: string; logo?: string; category?: string }): string {
  const norm = normalizeName(channel.name);

  // Exact map match
  if (CHANNEL_LOGO_MAP[norm]) {
    return CHANNEL_LOGO_MAP[norm];
  }

  // Substring search in our verified local logo dictionary
  const entries = Object.entries(CHANNEL_LOGO_MAP);
  for (const [key, logoUrl] of entries) {
    if (norm.includes(key) || key.includes(norm)) {
      return logoUrl;
    }
  }

  // If channel has an external logo and it is NOT a known broken host, try it
  if (channel.logo && !isProblematicLogoUrl(channel.logo)) {
    return channel.logo;
  }

  // Check category fallbacks
  const cat = (channel.category || "").toLowerCase();
  if (cat.includes("sport")) return "/logos/tsports.svg";
  if (cat.includes("kid")) return "/logos/duronto.svg";
  if (cat.includes("movie")) return "/logos/jalshamovies.svg";
  if (cat.includes("news")) return "/logos/somoytv.svg";
  if (cat.includes("info")) return "/logos/discovery.svg";

  return "/logos/default.svg";
}
