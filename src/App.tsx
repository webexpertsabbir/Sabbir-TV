import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Tv, Heart, Clock, Search, RefreshCw, Star, Play, 
  Compass, AlertCircle, RotateCcw,
  LayoutGrid, List, X, Trophy, Radio, Film, Newspaper, Baby,
  Share2, Check, Maximize2, Shrink, Monitor, ArrowUp, SkipBack, SkipForward
} from "lucide-react";
import { Channel, PlaybackHistory } from "./types";
import VideoPlayer from "./components/VideoPlayer";
import ChannelCard from "./components/ChannelCard";
import ChannelLogo from "./components/ChannelLogo";
import MobileBottomNav from "./components/MobileBottomNav";
import { fetchChannelsClientResilient, fallbackChannels } from "./fallbackData";

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  // Settings & Filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [historyList, setHistoryList] = useState<PlaybackHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [playlistSource, setPlaylistSource] = useState<string>("local");
  const [playlistDate, setPlaylistDate] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("toffee_theater_mode") === "true";
    } catch (_) {
      return false;
    }
  });
  const [isAppFullscreen, setIsAppFullscreen] = useState<boolean>(false);
  const [isMobileSticky, setIsMobileSticky] = useState<boolean>(false);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => 
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  const [channelToast, setChannelToast] = useState<string | null>(null);
  const playerSentinelRef = useRef<HTMLDivElement | null>(null);

  // Detect mobile viewport size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Track window scroll on mobile to seamlessly dock the video player to the top
  useEffect(() => {
    if (!isMobileScreen) {
      setIsMobileSticky(false);
      return;
    }

    const handleScroll = () => {
      const sentinel = playerSentinelRef.current;
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      // Stick when the sentinel scrolls above the top of viewport (or past header)
      const shouldStick = rect.top <= 2 && window.scrollY > 30;
      setIsMobileSticky(shouldStick);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileScreen]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsAppFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleAppFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle error:", err);
    }
  };

  const handleToggleTheaterMode = () => {
    setIsTheaterMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem("toffee_theater_mode", String(next));
      } catch (_) {}
      return next;
    });
  };

  const categoriesRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const dragRef = useRef({
    isMouseDown: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!categoriesRef.current) return;
    dragRef.current.isMouseDown = true;
    dragRef.current.startX = e.pageX - categoriesRef.current.offsetLeft;
    dragRef.current.scrollLeft = categoriesRef.current.scrollLeft;
    dragRef.current.hasMoved = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.isMouseDown || !categoriesRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoriesRef.current.offsetLeft;
    const walk = (x - dragRef.current.startX) * 1.5;
    if (Math.abs(walk) > 4) {
      dragRef.current.hasMoved = true;
    }
    categoriesRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    dragRef.current.isMouseDown = false;
  };

  // Load favorites & history from localStorage on mount
  useEffect(() => {
    try {
      const storedFavs = localStorage.getItem("toffee_favorites");
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs));
      }
      
      const storedHistory = localStorage.getItem("toffee_playback_history");
      if (storedHistory) {
        setHistoryList(JSON.parse(storedHistory));
      }

      // Check saved view mode
      const storedViewMode = localStorage.getItem("toffee_view_mode") as "grid" | "list" | null;
      if (storedViewMode) {
        setViewMode(storedViewMode);
      }
    } catch (e) {
      console.error("Local storage error:", e);
    }
  }, []);

  const handleSetViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("toffee_view_mode", mode);
    } catch (_) {}
  };

  // Fetch channels on mount with resilient Netlify & static host fallback
  const fetchChannels = async (forceFallback = false) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchChannelsClientResilient(forceFallback);
      const loadedChannels: Channel[] = data.channels || [];
      
      setChannels(loadedChannels);
      setPlaylistSource(data.source || "serverFallbackData");
      if (data.updatedOn) {
        setPlaylistDate(data.updatedOn);
      }

      // Extract unique categories
      const extractedCats = Array.from(new Set(loadedChannels.map(c => c.category))).filter((cat) => Boolean(cat));
      setCategories(["All", "Favorites", "History", ...extractedCats]);

      // Default play the first channel if none is chosen
      if (loadedChannels.length > 0 && (!selectedChannel || forceFallback)) {
        const defaultChannel = loadedChannels.find(c => 
          c.category.toLowerCase().includes("sport") || 
          c.name.toLowerCase().includes("t sports") ||
          c.name.toLowerCase().includes("ntv")
        ) || loadedChannels[0];
        setSelectedChannel(defaultChannel);
      }
    } catch (error: any) {
      console.error("Fetch channels error:", error);
      setChannels(fallbackChannels);
      setPlaylistSource("Verified Fallback (Offline Mode)");
      const extractedCats = Array.from(new Set(fallbackChannels.map(c => c.category))).filter((cat) => Boolean(cat));
      setCategories(["All", "Favorites", "History", ...extractedCats]);
      if (fallbackChannels.length > 0 && !selectedChannel) {
        setSelectedChannel(fallbackChannels[0]);
      }
      setErrorMessage("Live sync unavailable. Loaded verified offline channels.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChannels(false);
    setRefreshing(false);
  };

  const handleLoadFallback = async () => {
    setRefreshing(true);
    await fetchChannels(true);
    setRefreshing(false);
  };

  const handleSelectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    
    // Add to playback history
    const newHistoryItem: PlaybackHistory = {
      channelLink: ch.link,
      channelName: ch.name,
      watchedAt: Date.now()
    };
    
    const updatedHistory = [
      newHistoryItem, 
      ...historyList.filter(h => h.channelName !== ch.name)
    ].slice(0, 20);
    
    setHistoryList(updatedHistory);
    try {
      localStorage.setItem("toffee_playback_history", JSON.stringify(updatedHistory));
    } catch (_) {}

    // Mobile visual feedback toast
    setChannelToast(`চালু হচ্ছে: ${ch.name}`);
    setTimeout(() => setChannelToast(null), 2500);

    // Only scroll player to top if NOT currently sticky on mobile
    // When sticky, the user is intentionally browsing channels while watching uninterrupted!
    if (window.innerWidth < 1024 && !isMobileSticky) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleToggleFavorite = (channelName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated: string[];
    if (favorites.includes(channelName)) {
      updated = favorites.filter(f => f !== channelName);
    } else {
      updated = [...favorites, channelName];
    }
    setFavorites(updated);
    try {
      localStorage.setItem("toffee_favorites", JSON.stringify(updated));
    } catch (_) {}
  };

  const handleShareChannel = async () => {
    if (!selectedChannel) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${selectedChannel.name} - Sabbir Live TV`,
          text: `Watch ${selectedChannel.name} live on Sabbir Live TV!`,
          url: window.location.href
        });
      } catch (_) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Next / Prev channel helper
  const getIndexAndNavigate = (dir: "next" | "prev") => {
    if (!selectedChannel || channels.length === 0) return;
    const currentIndex = channels.findIndex(c => c.name === selectedChannel.name);
    if (currentIndex === -1) return;

    let targetIndex = dir === "next" ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= channels.length) targetIndex = 0;
    if (targetIndex < 0) targetIndex = channels.length - 1;
    
    handleSelectChannel(channels[targetIndex]);
  };

  // Filter channels based on tab selection, search text, and arrays
  const filteredChannels = channels.filter((ch) => {
    if (activeCategory === "Favorites") {
      if (!favorites.includes(ch.name)) return false;
    } else if (activeCategory === "History") {
      if (!historyList.some(h => h.channelName === ch.name)) return false;
    } else if (activeCategory !== "All") {
      if (ch.category !== activeCategory) return false;
    }

    if (searchQuery.trim()) {
      const matchText = searchQuery.toLowerCase().trim();
      const nameMatch = ch.name.toLowerCase().includes(matchText);
      const categoryMatch = ch.category.toLowerCase().includes(matchText);
      return nameMatch || categoryMatch;
    }

    return true;
  });

  // Category Icon helper
  const getCategoryIcon = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower === "all") return <Tv size={13} className="shrink-0" />;
    if (lower === "favorites") return <Star size={13} className="shrink-0 text-toffee-gold fill-toffee-gold" />;
    if (lower === "history") return <Clock size={13} className="shrink-0" />;
    if (lower.includes("sport") || lower.includes("খেলা")) return <Trophy size={13} className="shrink-0 text-amber-400" />;
    if (lower.includes("bangla") || lower.includes("বাংলা")) return <Radio size={13} className="shrink-0 text-emerald-400" />;
    if (lower.includes("news") || lower.includes("সংবাদ")) return <Newspaper size={13} className="shrink-0 text-sky-400" />;
    if (lower.includes("kid") || lower.includes("কার্টুন")) return <Baby size={13} className="shrink-0 text-pink-400" />;
    return <Film size={13} className="shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-gradient-radial-brand text-gray-100 flex flex-col selection:bg-toffee-accent/50 selection:text-white overflow-x-clip font-sans relative pb-24 lg:pb-6">
      
      {/* Visual background lights for beautiful design */}
      <div className="absolute top-0 right-1/4 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] bg-toffee-accent/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-5 w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Styled Responsive Top Header (Relative on mobile so video can dock at top, sticky on desktop) */}
      <header id="app_header" className="relative lg:sticky lg:top-0 bg-[#08090d]/90 backdrop-blur-xl border-b border-frosted-medium z-30 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-toffee-accent to-pink-500 flex items-center justify-center text-white shadow-lg shadow-toffee-accent/25 shrink-0">
            <Tv size={18} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-display font-black text-sm sm:text-base md:text-lg tracking-tight text-white truncate">
                SMART LIVE TV
              </h1>
              <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-bold bg-toffee-accent/15 text-toffee-accent px-1.5 py-0.5 rounded border border-toffee-accent/30 uppercase shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-toffee-accent animate-ping" />
                LIVE
              </span>
            </div>
            <p className="hidden sm:block text-[10px] text-gray-400 font-mono truncate">
              ULTRA HD LIVE STREAMING • SECURE PROXY
            </p>
          </div>
        </div>

        {/* Global actions: Fallback & Refresh */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Desktop Theater Mode Toggle */}
          <button
            id="global_theater_btn"
            type="button"
            onClick={handleToggleTheaterMode}
            title={isTheaterMode ? "Exit Theater Mode (স্বাভাবিক ভিউ) [T]" : "Theater Mode / Wide Screen (থিয়েটার মোড / ওয়াইড ভিউ) [T]"}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition active:scale-95 touch-manipulation ${
              isTheaterMode 
                ? "bg-toffee-accent text-white border-toffee-accent shadow-md shadow-toffee-accent/20" 
                : "bg-white/5 hover:bg-white/10 text-gray-300 border-white/10"
            }`}
          >
            <Monitor size={13} />
            <span>{isTheaterMode ? "স্বাভাবিক ভিউ" : "থিয়েটার মোড"}</span>
          </button>

          {/* Desktop / Global Fullscreen Toggle */}
          <button
            id="global_fullscreen_btn"
            type="button"
            onClick={toggleAppFullscreen}
            title={isAppFullscreen ? "Exit Fullscreen (ফুলস্ক্রিন থেকে বের হন) [F]" : "Full Screen Desktop View (ডেস্কটপ ফুলস্ক্রিন) [F]"}
            className="hidden sm:flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-white/10 transition active:scale-95 touch-manipulation"
          >
            {isAppFullscreen ? <Shrink size={13} /> : <Maximize2 size={13} />}
            <span>{isAppFullscreen ? "স্বাভাবিক স্ক্রিন" : "ফুলস্ক্রিন"}</span>
          </button>

          <button
            id="global_fallback_btn"
            type="button"
            onClick={handleLoadFallback}
            disabled={refreshing}
            title="Load verified offline channels"
            className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-emerald-500/25 transition active:scale-95 disabled:opacity-50 touch-manipulation"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Fallback Feed</span>
          </button>

          <button
            id="global_refresh_btn"
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Sync live playlist"
            className={`flex items-center gap-1.5 bg-toffee-accent/10 hover:bg-toffee-accent/20 text-toffee-accent px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-toffee-accent/25 transition active:scale-95 disabled:opacity-50 touch-manipulation ${
              refreshing ? "opacity-50" : ""
            }`}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden xs:inline">{refreshing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </header>

      {/* Dynamic Status / Fallback Alert Banner */}
      {errorMessage && (
        <div id="app_alert_banner" className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 px-4 sm:px-6 py-2 text-xs flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button 
            id="dismiss_alert_btn"
            type="button"
            onClick={() => setErrorMessage(null)} 
            className="text-amber-400 hover:text-white text-[11px] underline cursor-pointer p-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Responsive Grid Layout (Full Screen / Ultra-Wide on Desktop) */}
      <main className={`flex-1 w-full px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-4 md:py-6 flex z-10 mx-auto transition-all duration-300 ${
        isTheaterMode
          ? "flex-col max-w-[1920px] 2xl:max-w-[2400px] gap-4 sm:gap-6"
          : "flex-col lg:flex-row max-w-[1920px] 2xl:max-w-[2400px] gap-4 sm:gap-6 lg:gap-8"
      }`}>
        
        {/* LEFT/TOP COLUMN: Player & Now Playing Stats */}
        <section className={`w-full flex flex-col gap-3 sm:gap-4 min-w-0 transition-all duration-300 ${
          isTheaterMode ? "w-full" : "lg:flex-1"
        }`}>
          
          {/* Sentinel to track scroll position on mobile */}
          <div ref={playerSentinelRef} className="w-full h-0 pointer-events-none" />

          {/* Placeholder when sticky on mobile to avoid layout shifts */}
          {isMobileSticky && isMobileScreen && (
            <div 
              className="w-full aspect-video rounded-2xl bg-black/30 border border-white/5 flex items-center justify-center text-xs font-mono mb-2 sm:mb-4 lg:hidden"
              aria-hidden="true"
            >
              <div className="flex items-center gap-2 text-toffee-accent/80 font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-toffee-accent animate-ping" />
                <span>ভিডিও উপরে ফিক্সড আছে</span>
              </div>
            </div>
          )}

          {/* Responsive Video Player Container: Docks cleanly to top on mobile when scrolling */}
          <div 
            id="player_outer_wrapper"
            className={`w-full transition-all duration-300 ${
              isMobileSticky && isMobileScreen
                ? "fixed top-0 left-0 right-0 z-40 bg-[#08090d] shadow-2xl shadow-black/95 border-b border-white/10 lg:static lg:bg-transparent lg:shadow-none lg:border-none"
                : "relative"
            }`}
          >
            <VideoPlayer 
              channel={selectedChannel}
              onNextChannel={() => getIndexAndNavigate("next")}
              onPrevChannel={() => getIndexAndNavigate("prev")}
              isTheaterMode={isTheaterMode}
              onToggleTheaterMode={handleToggleTheaterMode}
              isMobileSticky={isMobileSticky && isMobileScreen}
              onScrollToTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            />

            {/* Mobile Sticky Mini Dock Bar - Appears right under the sticky video on mobile */}
            {isMobileSticky && isMobileScreen && selectedChannel && (
              <div 
                id="mobile_sticky_dock_bar"
                className="lg:hidden flex items-center justify-between px-3 py-1.5 bg-[#0b0d14]/95 border-t border-white/10 text-xs text-white backdrop-blur-md"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-black/50 p-0.5 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                    <ChannelLogo channel={selectedChannel} imgClassName="max-h-full max-w-full object-contain" />
                  </div>
                  <span className="font-display font-bold text-[11px] sm:text-xs truncate max-w-[140px] xs:max-w-[190px]">
                    {selectedChannel.name}
                  </span>
                  <span className="flex items-center gap-1 text-[8px] font-mono text-toffee-accent font-bold px-1 py-0.5 rounded bg-toffee-accent/15 uppercase shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-toffee-accent animate-ping" />
                    LIVE
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    id="sticky_prev_ch_btn"
                    type="button"
                    onClick={() => getIndexAndNavigate("prev")}
                    className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 active:scale-90 touch-manipulation cursor-pointer"
                    title="আগের চ্যানেল"
                    aria-label="আগের চ্যানেল"
                  >
                    <SkipBack size={13} />
                  </button>
                  <button
                    id="sticky_next_ch_btn"
                    type="button"
                    onClick={() => getIndexAndNavigate("next")}
                    className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 active:scale-90 touch-manipulation cursor-pointer"
                    title="পরের চ্যানেল"
                    aria-label="পরের চ্যানেল"
                  >
                    <SkipForward size={13} />
                  </button>
                  <button
                    id="sticky_scroll_top_btn"
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-toffee-accent/20 text-toffee-accent border border-toffee-accent/35 text-[10px] font-bold active:scale-95 touch-manipulation ml-1 cursor-pointer"
                    title="শীর্ষে যান"
                    aria-label="শীর্ষে যান"
                  >
                    <ArrowUp size={11} />
                    <span>উপরে</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected Channel Metadata Bar */}
          {selectedChannel && (
            <div 
              id="selected_channel_bar"
              className="bg-frosted-card rounded-xl sm:rounded-2xl border border-frosted-medium p-3 sm:p-4 flex items-center justify-between gap-3 shadow-lg shadow-black/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/40 p-1 border border-frosted-medium shrink-0 overflow-hidden flex items-center justify-center">
                  <ChannelLogo
                    channel={selectedChannel}
                    imgClassName="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-white font-display font-bold text-sm sm:text-base md:text-lg leading-tight truncate">
                      {selectedChannel.name}
                    </h2>
                    <span className="hidden xs:inline-flex text-[9px] font-mono bg-toffee-accent/15 text-toffee-accent px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                      LIVE
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 font-mono truncate mt-0.5">
                    {selectedChannel.category}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Theater Mode, Fullscreen, Favorite & Share */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Desktop Theater Button on Channel Bar */}
                <button
                  id="metadata_theater_toggle"
                  type="button"
                  onClick={handleToggleTheaterMode}
                  className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 touch-manipulation cursor-pointer ${
                    isTheaterMode
                      ? "bg-toffee-accent text-white border-toffee-accent"
                      : "bg-white/5 border-white/10 hover:border-toffee-accent/50 text-gray-300"
                  }`}
                  title="থিয়েটার ভিউ টগল করুন [T]"
                >
                  <Monitor size={15} />
                  <span>{isTheaterMode ? "স্বাভাবিক" : "থিয়েটার"}</span>
                </button>

                <button
                  id="metadata_share_btn"
                  type="button"
                  onClick={handleShareChannel}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition active:scale-90 touch-manipulation cursor-pointer"
                  title="Share channel"
                  aria-label="Share channel"
                >
                  {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
                </button>

                <button
                  id="metadata_favorite_toggle"
                  type="button"
                  onClick={(e) => handleToggleFavorite(selectedChannel.name, e)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 touch-manipulation cursor-pointer ${
                    favorites.includes(selectedChannel.name)
                      ? "bg-toffee-accent border-toffee-accent text-white shadow-md shadow-toffee-accent/20"
                      : "bg-white/5 border-white/10 hover:border-toffee-accent text-gray-300"
                  }`}
                  aria-label={favorites.includes(selectedChannel.name) ? "In Favorites" : "Add to Favorites"}
                >
                  <Star size={15} className={favorites.includes(selectedChannel.name) ? "fill-white text-white" : "text-gray-400"} />
                  <span className="hidden sm:inline">
                    {favorites.includes(selectedChannel.name) ? "ফেভারিট" : "পছন্দ"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Double-Tap Helper Hint on Mobile */}
          <div className="lg:hidden flex items-center justify-between text-[10px] text-gray-400 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-1.5 font-mono">
            <span>💡 ডবল ট্যাপ: বামে আগের, ডানে পরের চ্যানেল</span>
            <span className="text-toffee-accent font-bold">FULL HD</span>
          </div>
        </section>

        {/* RIGHT/BOTTOM COLUMN: Channel Directory & Browsing */}
        <section 
          id="channel_directory_section" 
          className={`w-full flex flex-col gap-3 sm:gap-4 scroll-mt-14 transition-all duration-300 ${
            isTheaterMode 
              ? "w-full" 
              : "lg:w-[380px] xl:w-[440px] 2xl:w-[480px] shrink-0"
          }`}
        >
          {/* Search Bar & View Mode Switcher Card */}
          <div className="bg-frosted-card border border-frosted-medium rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col gap-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-display font-semibold text-white flex items-center gap-2">
                <Compass size={15} className="text-toffee-accent" />
                <span>চ্যানেল তালিকা ({filteredChannels.length})</span>
              </h3>

              {/* View Mode Toggle: Grid vs List */}
              <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
                <button
                  id="view_mode_grid_btn"
                  type="button"
                  onClick={() => handleSetViewMode("grid")}
                  className={`p-1.5 rounded-md transition-all touch-manipulation ${
                    viewMode === "grid" 
                      ? "bg-toffee-accent text-white shadow-sm" 
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="Grid View (কার্ড ভিউ)"
                  aria-label="Grid View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  id="view_mode_list_btn"
                  type="button"
                  onClick={() => handleSetViewMode("list")}
                  className={`p-1.5 rounded-md transition-all touch-manipulation ${
                    viewMode === "list" 
                      ? "bg-toffee-accent text-white shadow-sm" 
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="List View (তালিকা ভিউ)"
                  aria-label="List View"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
            
            {/* Search Input Field */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                ref={searchInputRef}
                id="channel_search_bar"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="চ্যানেল খুঁজুন (Sports, News, Bangla...)"
                className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-9 py-2 sm:py-2.5 text-xs text-white placeholder-gray-400 outline-none focus:border-toffee-accent/60 focus:ring-1 focus:ring-toffee-accent/30 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Touch-Smooth Category Pills Slider */}
          <div className="relative w-full">
            <div 
              ref={categoriesRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none snap-x font-sans w-full scroll-smooth select-none cursor-grab active:cursor-grabbing px-0.5"
            >
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    id={`cat_chip_${cat.replace(/\s+/g, '_')}`}
                    type="button"
                    onClick={(e) => {
                      if (dragRef.current.hasMoved) {
                        e.preventDefault();
                        return;
                      }
                      setActiveCategory(cat);
                    }}
                    className={`snap-start flex items-center gap-1.5 text-xs px-3 py-1.5 sm:py-2 rounded-xl font-medium cursor-pointer transition-all duration-200 capitalize whitespace-nowrap focus:outline-none touch-manipulation active:scale-95 ${
                      isActive 
                        ? "bg-toffee-accent text-white font-bold shadow-md shadow-toffee-accent/25 ring-1 ring-toffee-accent/50" 
                        : "bg-frosted text-gray-400 hover:text-white border border-frosted-light hover:bg-frosted-card"
                    }`}
                  >
                    {getCategoryIcon(cat)}
                    <span>{cat}</span>
                    {cat === "Favorites" && favorites.length > 0 && (
                      <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
                        {favorites.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Channels Listing (Responsive Grid or List) */}
          <div className={`bg-frosted-card border border-frosted-medium rounded-xl sm:rounded-2xl overflow-hidden flex flex-col shadow-xl transition-all duration-300 ${
            isTheaterMode ? "max-h-none" : "lg:max-h-[75vh]"
          }`}>
            
            {/* Header info bar */}
            <div className="p-3 sm:p-3.5 border-b border-frosted-light flex justify-between items-center bg-white/[0.02] backdrop-blur-md">
              <span className="text-[11px] font-mono text-gray-400">
                দেখাচ্ছে: <span className="text-toffee-accent font-bold font-sans">{filteredChannels.length}</span> টি চ্যানেল
              </span>

              {activeCategory === "History" && historyList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryList([]);
                    localStorage.removeItem("toffee_playback_history");
                  }}
                  className="text-[10px] font-mono text-gray-400 hover:text-toffee-accent uppercase tracking-wider font-bold transition cursor-pointer p-1"
                >
                  ক্লিয়ার হিস্ট্রি
                </button>
              )}
            </div>

            {/* Scrollable / Natural channels container */}
            <div 
              id="channels_scroll_container" 
              className="overflow-y-auto flex-1 p-2.5 sm:p-3.5"
            >
              {loading ? (
                // Skeleton loading state
                <div className={
                  viewMode === "grid" 
                    ? isTheaterMode 
                      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5" 
                      : "grid grid-cols-2 gap-2.5" 
                    : "flex flex-col gap-2.5"
                }>
                  {Array.from({ length: isTheaterMode ? 12 : 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-xl bg-frosted border border-frosted-light animate-pulse flex flex-col gap-2">
                      <div className="h-16 bg-white/5 rounded-lg w-full" />
                      <div className="h-3 bg-white/5 rounded w-3/4" />
                      <div className="h-2 bg-white/5 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredChannels.length > 0 ? (
                <div className={
                  viewMode === "grid"
                    ? isTheaterMode
                      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3"
                      : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-2.5"
                    : isTheaterMode
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5"
                      : "flex flex-col gap-2"
                }>
                  <AnimatePresence mode="popLayout">
                    {filteredChannels.map((ch, index) => {
                      const isSelected = selectedChannel?.name === ch.name;
                      const isFav = favorites.includes(ch.name);
                      
                      return (
                        <ChannelCard
                          key={ch.name}
                          channel={ch}
                          index={index}
                          isSelected={isSelected}
                          isFavorite={isFav}
                          viewMode={viewMode}
                          onSelect={handleSelectChannel}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div id="no_channels_found" className="text-center py-12 px-4">
                  <AlertCircle size={32} className="text-zinc-600 mx-auto mb-2" />
                  <p className="text-white/70 text-xs font-semibold">কোনো চ্যানেল খুঁজে পাওয়া যায়নি</p>
                  <p className="text-gray-400 text-[11px] mt-1">অন্য ক্যাটাগরি বেছে নিন অথবা নতুন কি-ওয়ার্ড দিয়ে খুঁজুন।</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Aesthetic Literal Footer */}
      <footer id="app_footer" className="mt-auto border-t border-frosted-light py-3 px-4 text-center text-[10px] font-mono text-gray-400 bg-[#08090d]/80 backdrop-blur-md">
        <p>© 2026 Smart Live TV Engine • Fast M3U8 Streaming & Secure Web Proxy</p>
      </footer>

      {/* Fixed Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <MobileBottomNav
        activeCategory={activeCategory}
        onSelectCategory={(cat) => setActiveCategory(cat)}
        favoritesCount={favorites.length}
        historyCount={historyList.length}
      />
    </div>
  );
}
