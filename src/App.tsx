import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Tv, Sparkles, Heart, Clock, Search, RefreshCw, Star, Play, 
  HelpCircle, Monitor, Compass, AlertCircle, RefreshCcw, LogOut,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Channel, PlaybackHistory } from "./types";
import VideoPlayer from "./components/VideoPlayer";
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

  const categoriesRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({
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
    const walk = (x - dragRef.current.startX) * 1.5; // multiplier for nice speed
    if (Math.abs(walk) > 4) {
      dragRef.current.hasMoved = true;
    }
    categoriesRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    dragRef.current.isMouseDown = false;
  };

  const scrollCategories = (direction: "left" | "right") => {
    if (categoriesRef.current) {
      const scrollAmount = 180;
      categoriesRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
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
    } catch (e) {
      console.error("Local storage corruption, resetting states:", e);
    }
  }, []);

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
      // Guarantee channels are always populated even if all fetches fail
      setChannels(fallbackChannels);
      setPlaylistSource("Verified Fallback (Offline Mode)");
      const extractedCats = Array.from(new Set(fallbackChannels.map(c => c.category))).filter((cat) => Boolean(cat));
      setCategories(["All", "Favorites", "History", ...extractedCats]);
      if (fallbackChannels.length > 0 && !selectedChannel) {
        setSelectedChannel(fallbackChannels[0]);
      }
      setErrorMessage("Live API sync unavailable. Loaded verified offline channels.");
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
    ].slice(0, 15); // keep max 15 items
    
    setHistoryList(updatedHistory);
    localStorage.setItem("toffee_playback_history", JSON.stringify(updatedHistory));
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
    localStorage.setItem("toffee_favorites", JSON.stringify(updated));
  };

  // Find next/prev channel for keyboard mapping or navigation
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
    // 1. Tag filtering
    if (activeCategory === "Favorites") {
      if (!favorites.includes(ch.name)) return false;
    } else if (activeCategory === "History") {
      if (!historyList.some(h => h.channelName === ch.name)) return false;
    } else if (activeCategory !== "All") {
      if (ch.category !== activeCategory) return false;
    }

    // 2. Search query filtering
    if (searchQuery) {
      const matchText = searchQuery.toLowerCase();
      const nameMatch = ch.name.toLowerCase().includes(matchText);
      const categoryMatch = ch.category.toLowerCase().includes(matchText);
      return nameMatch || categoryMatch;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-radial-brand text-gray-100 flex flex-col selection:bg-toffee-accent/50 selection:text-white overflow-x-hidden pt-1 font-sans relative">
      
      {/* Visual background lights for beautiful design */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-toffee-accent/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-[400px] h-[400px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Styled Top Header Navigation Bar */}
      <header id="app_header" className="sticky top-0 bg-frosted border-b border-frosted-medium z-40 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-toffee-accent to-pink-500 flex items-center justify-center text-white shadow-lg shadow-toffee-accent/20">
            <Tv size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-lg tracking-tight text-white">SABBIR LIVE TV</h1>
              <span className="text-[9px] font-mono font-semibold bg-toffee-accent/10 text-toffee-accent px-1.5 py-0.5 rounded border border-toffee-accent/25 uppercase">
                AUTO-SYNCPLAY
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono">HIGH QUALITY SECURE STREAM PROXY ENGINE</p>
          </div>
        </div>

        {/* Global status indicators & Refresh live M3U buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="global_fallback_btn"
            onClick={handleLoadFallback}
            disabled={refreshing}
            title="Load verified working streams from serverFallbackData"
            className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-emerald-500/20 transition-all focus:outline-none active:scale-95 disabled:opacity-50"
          >
            <Tv size={13} />
            <span className="hidden sm:inline">Fallback Feed</span>
          </button>

          <button
            id="global_refresh_btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 bg-toffee-accent/10 hover:bg-toffee-accent text-toffee-accent hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-toffee-accent/20 transition-all focus:outline-none ${
              refreshing ? "opacity-50" : "active:scale-95"
            }`}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden xs:inline">{refreshing ? "Syncing..." : "Sync Remote"}</span>
          </button>
        </div>
      </header>

      {/* Dynamic Status / Fallback Alert Banner */}
      {errorMessage && (
        <div id="app_alert_banner" className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 px-4 md:px-8 py-2 text-xs flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button 
            id="dismiss_alert_btn"
            onClick={() => setErrorMessage(null)} 
            className="text-amber-400 hover:text-white text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Flex layout spanning full screen width */}
      <main className="flex-1 w-full max-w-none px-4 md:px-8 py-6 flex flex-col lg:flex-row gap-6 lg:gap-8 z-10">
        
        {/* LEFT COLUMN: Player & Now Playing Stats (Occupies all remaining left space) */}
        <section className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="sticky top-20">
            {/* The Custom Player */}
            <VideoPlayer 
              channel={selectedChannel}
              onNextChannel={() => getIndexAndNavigate("next")}
              onPrevChannel={() => getIndexAndNavigate("prev")}
            />

            {/* Selected Channel Metadata & Actions Card */}
            {selectedChannel && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-frosted-card rounded-2xl border border-frosted-medium p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-lg shadow-black/20"
              >
                <div className="flex gap-4 items-center">
                  {selectedChannel.logo ? (
                    <img
                      src={selectedChannel.logo}
                      alt={selectedChannel.name}
                      className="w-16 h-16 object-contain rounded-xl bg-black/40 p-2 border border-frosted-medium"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-toffee-accent/10 flex items-center justify-center text-toffee-accent border border-toffee-accent/20">
                      <Tv size={24} />
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-mono bg-toffee-accent/15 text-toffee-accent px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      {selectedChannel.category}
                    </span>
                    <h3 className="text-white font-display text-lg font-bold mt-1.5">
                      {selectedChannel.name}
                    </h3>
                  </div>
                </div>

                {/* Actions: Favorite / Unfavorite */}
                <button
                  id="metadata_favorite_toggle"
                  onClick={(e) => handleToggleFavorite(selectedChannel.name, e)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    favorites.includes(selectedChannel.name)
                      ? "bg-toffee-accent border-toffee-accent text-white"
                      : "bg-white/5 border-white/10 hover:border-toffee-accent hover:text-toffee-accent text-gray-300"
                  }`}
                >
                  <Star size={14} className={favorites.includes(selectedChannel.name) ? "fill-white" : ""} />
                  <span>{favorites.includes(selectedChannel.name) ? "In Favorites" : "Add to Favorites"}</span>
                </button>
              </motion.div>
            )}


          </div>
        </section>

        {/* RIGHT COLUMN: Channel search, Filter Tabs, and Grid listing (Stays consistent fixed width on the far right) */}
        <section className="w-full lg:w-[360px] xl:w-[400px] shrink-0 flex flex-col gap-6">
          
          {/* Header Search Input */}
          <div className="relative bg-frosted-card border border-frosted-medium rounded-2xl p-4 flex flex-col gap-4 shadow-lg">
            <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
              <Compass size={15} className="text-toffee-accent" />
              Browse Channels Directory
            </h3>
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                id="channel_search_bar"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sports, news, kids, dramas..."
                className="w-full bg-black/30 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-400 outline-none focus:border-toffee-accent/50 focus:ring-1 focus:ring-toffee-accent/30 transition-all font-sans"
              />
            </div>
          </div>

          {/* Categorized Slider Tabs with drag-and-swipe support */}
          <div className="relative w-full max-w-full">
            <div 
              ref={categoriesRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x font-sans w-full scroll-smooth px-1 select-none cursor-grab active:cursor-grabbing"
            >
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={(e) => {
                      if (dragRef.current.hasMoved) {
                        e.preventDefault();
                        return;
                      }
                      setActiveCategory(cat);
                    }}
                    className={`snap-start relative text-xs px-3.5 py-2 rounded-lg font-medium cursor-pointer transition-all duration-200 capitalize whitespace-nowrap focus:outline-none ${
                      isActive 
                        ? "bg-toffee-accent text-white font-bold shadow-md shadow-toffee-accent/20" 
                        : "bg-frosted text-gray-400 hover:text-white border border-frosted-light hover:bg-frosted-active"
                    }`}
                  >
                    <span>{cat}</span>
                    {isActive && (
                      <motion.div 
                        layoutId="activeTabGlow"
                        className="absolute inset-0 rounded-lg border border-toffee-accent/50 filter blur-xs -z-10" 
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid channels display container */}
          <div className="bg-frosted-card border border-frosted-medium rounded-2xl overflow-hidden flex flex-col max-h-[600px] lg:max-h-[70vh] shadow-xl">
            
            <div className="p-4 border-b border-frosted-light flex justify-between items-center bg-white/[0.02] backdrop-blur-md">
              <span className="text-[11px] font-mono text-gray-400">
                Found <span className="text-toffee-accent font-bold font-sans">{filteredChannels.length}</span> channels
              </span>

              {activeCategory === "History" && historyList.length > 0 && (
                <button
                  onClick={() => {
                    setHistoryList([]);
                    localStorage.removeItem("toffee_playback_history");
                  }}
                  className="text-[10px] font-mono text-gray-500 hover:text-toffee-accent uppercase tracking-widest font-bold"
                >
                  Clear history
                </button>
              )}
            </div>

            <div id="channels_scroll_grid" className="overflow-y-auto flex-1 p-4 flex flex-col gap-2.5">
              {loading ? (
                // Loading placeholding structures
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 items-center p-3 rounded-xl bg-frosted border border-frosted-light animate-pulse">
                    <div className="w-12 h-12 rounded-lg bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-white/5 rounded-sm w-1/2" />
                      <div className="h-2.5 bg-white/5 rounded-sm w-1/4" />
                    </div>
                  </div>
                ))
              ) : filteredChannels.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {filteredChannels.map((ch, index) => {
                    const isSelected = selectedChannel?.name === ch.name;
                    const isFav = favorites.includes(ch.name);
                    
                    return (
                      <motion.div
                        layout
                        key={ch.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
                        onClick={() => handleSelectChannel(ch)}
                        className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                          isSelected 
                            ? "bg-frosted-active border-toffee-accent/50 shadow-md shadow-toffee-accent/5" 
                            : "bg-frosted border-frosted-light hover:border-frosted-medium hover:bg-frosted-active"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Feed Image Logo */}
                          {ch.logo ? (
                            <img
                              src={ch.logo}
                              alt={ch.name}
                              className="w-12 h-12 object-contain bg-black/20 p-1.5 rounded-lg border border-frosted-light group-hover:scale-105 transition duration-300"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-frosted border border-frosted-light flex items-center justify-center text-gray-400">
                              <Tv size={18} />
                            </div>
                          )}

                          <div className="font-display">
                            <h4 id={`channel_name_${index}`} className={`text-xs font-bold leading-tight ${isSelected ? "text-toffee-accent" : "text-white group-hover:text-toffee-accent transition"}`}>
                              {ch.name}
                            </h4>
                            <span className="text-[10px] text-gray-400 inline-block font-mono mt-1">
                              {ch.category}
                            </span>
                          </div>
                        </div>

                        {/* Interactive triggers */}
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-toffee-accent opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-toffee-accent" />
                            </span>
                          )}

                          {/* Fast Favorite toggle star */}
                          <button
                            id={`fav_toggle_${index}`}
                            onClick={(e) => handleToggleFavorite(ch.name, e)}
                            className="p-1.5 rounded-md hover:bg-white/15 text-gray-400 hover:text-toffee-accent transition cursor-pointer"
                          >
                            <Star size={13} className={isFav ? "fill-toffee-gold text-toffee-gold" : "text-gray-500"} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <div id="no_channels_found" className="text-center py-12 px-4">
                  <AlertCircle size={28} className="text-zinc-600 mx-auto mb-3" />
                  <p className="text-white/60 text-xs font-medium">No links match your search parameters</p>
                  <p className="text-gray-400 text-[11px] mt-1">Select another tab filter or try a typing keywords.</p>
                </div>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* Aesthetic human literal Footer bar */}
      <footer id="app_footer" className="mt-auto border-t border-frosted-light py-4 text-center text-[10px] font-mono text-gray-400 bg-[#08090d]/60 backdrop-blur-md">
        <p>© 2026 Sabbir NetStream IPTV Engine • Powered by High-performance Node Proxy & WebRTC players</p>
      </footer>
    </div>
  );
}
