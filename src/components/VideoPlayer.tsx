import React, { useRef, useEffect, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize2, Tv, AlertCircle, RefreshCw, Layers, Check, Expand, Shrink, SkipBack, SkipForward, PictureInPicture, Monitor } from "lucide-react";
import { Channel } from "../types";

interface VideoPlayerProps {
  channel: Channel | null;
  onPrevChannel?: () => void;
  onNextChannel?: () => void;
  isTheaterMode?: boolean;
  onToggleTheaterMode?: () => void;
}

export default function VideoPlayer({ 
  channel, 
  onPrevChannel, 
  onNextChannel,
  isTheaterMode = false,
  onToggleTheaterMode
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<"video" | "contain" | "cover">("video");
  const [retryCount, setRetryCount] = useState<number>(0);
  const [streamMode, setStreamMode] = useState<"proxy" | "direct">("proxy");
  const [qualityLevels, setQualityLevels] = useState<any[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [streamStats, setStreamStats] = useState<{ fps: number; bandwidth: number } | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [tapRipple, setTapRipple] = useState<"prev" | "next" | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls timer management
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Only auto-hide if playing, not buffering/error, and quality menu isn't open
    if (isPlaying && !showQualityMenu && !loadError && !isBuffering) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2800);
    }
  };

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showQualityMenu && !loadError && !isBuffering) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 800);
    }
  };

  // Keep controls visible if paused, buffering, error, or quality menu open
  useEffect(() => {
    if (!isPlaying || showQualityMenu || loadError || isBuffering) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showQualityMenu, loadError, isBuffering]);

  useEffect(() => {
    if (!channel) return;
    
    // Reset state for new channel
    setLoadError(null);
    setIsBuffering(true);
    setQualityLevels([]);
    setCurrentQuality(-1);
    
    // Construct proxy stream URL and active URL (handles Netlify static environments)
    const proxyStreamUrl = `/api/stream?url=${encodeURIComponent(channel.link)}&cookie=${encodeURIComponent(channel.cookie || "")}&ua=${encodeURIComponent(channel.user_agent || "")}`;
    const activeStreamUrl = streamMode === "direct" ? channel.link : proxyStreamUrl;
    
    const video = videoRef.current;
    if (!video) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 20,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 0,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 15000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 15000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 15000,
      });
      hlsRef.current = hls;

      hls.loadSource(activeStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        video.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });

        // Parse qualities
        if (hls.levels && hls.levels.length > 0) {
          setQualityLevels(hls.levels);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const stats = hls.levels[data.level];
        if (stats) {
          setStreamStats({
            fps: 30, // Default estimate
            bandwidth: stats.bitrate
          });
        }
      });

      let consecutiveFragErrors = 0;
      hls.on(Hls.Events.ERROR, (_, data) => {
        // If proxy fails with 404/manifest error (common in static Netlify hosting), auto fallback to direct link
        if (
          (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.response?.code === 404) &&
          streamMode === "proxy"
        ) {
          console.warn("Proxy manifest failed (404/network). Auto-switching to Direct Stream mode:", channel.link);
          setStreamMode("direct");
          return;
        }

        // Immediate detection of 403 authorization/expired errors
        if (data.response?.code === 403) {
          setLoadError("Match Link Expired (HTTP 403): This live match-specific option is currently offline. Since temporary streaming keys are active only during live play, this stream has expired. Try checking our active 24/7 networks like SONY SPORTS, TOFFEE Sports, or Somoy TV!");
          return;
        }

        // Detect consecutive network or chunk load issues (e.g. 502/404/403/504)
        if (
          data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || 
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR
        ) {
          consecutiveFragErrors++;
          
          if (consecutiveFragErrors >= 5 || data.response?.code === 404) {
            setLoadError(`Event currently offline. Since match and temporary event feeds are non-continuous, this channel is inactive if no live broadcast is playing right now. Try checking Somoy TV, TOFFEE Sports, Sony Sports, or other active 24/7 channels!`);
          }
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (data.response?.code === 403) {
                setLoadError("Match Link Expired (HTTP 403): This live match-specific option is currently offline. Since temporary streaming keys are active only during live play, this stream has expired. Try checking our active 24/7 networks like SONY SPORTS, TOFFEE Sports, or Somoy TV!");
              } else if (data.response?.code === 404) {
                setLoadError(`Event currently offline. Since matches and live events are non-continuous, this channel is inactive if no live broadcast is playing right now. Try checking Somoy TV, TOFFEE Sports, Sony Sports, or other active feeds!`);
              } else if (consecutiveFragErrors < 6) {
                hls.startLoad();
              } else {
                setLoadError("Server stream pathway timed out. Reconnect below or browse other active channels.");
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setLoadError("The live streaming session holds invalid headers. Click Reconnect below to establish a new tunnel.");
              hls.destroy();
              break;
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        consecutiveFragErrors = 0;
      });

      // Handle buffering events
      const handleWaiting = () => setIsBuffering(true);
      const handlePlaying = () => {
        setIsBuffering(false);
        setLoadError(null);
      };

      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("playing", handlePlaying);

      return () => {
        video.removeEventListener("waiting", handleWaiting);
        video.removeEventListener("playing", handlePlaying);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native iOS Safari support fallback
      video.src = activeStreamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsBuffering(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
      
      video.addEventListener("error", () => {
        if (streamMode === "proxy") {
          console.warn("Proxy failed on iOS. Switching to direct mode...");
          setStreamMode("direct");
        } else {
          setLoadError("Match/Event Currently Offline: This live event channel is currently offline because no live match has started yet. Please choose another active 24/7 channel!");
        }
      });
    } else {
      setLoadError("HLS playback is not supported on this browser.");
    }
  }, [channel, retryCount, streamMode]);

  // Sync volume state to video ref
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = isMuted ? 0 : volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      video.play().then(() => {
        setIsPlaying(true);
        resetControlsTimer();
      }).catch((e) => {
        console.error("Play failed:", e);
      });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolume = parseFloat(e.target.value);
    setVolume(nextVolume);
    if (nextVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
          setIsFullscreen(true);
        } else if ((video as any)?.webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        }
        // Auto rotate to landscape if supported on mobile devices
        if ((screen.orientation as any)?.lock) {
          (screen.orientation as any).lock("landscape").catch(() => {});
        }
      } catch (err) {
        console.error("Fullscreen error:", err);
        if ((video as any)?.webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        }
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      if ((screen.orientation as any)?.unlock) {
        try {
          (screen.orientation as any).unlock();
        } catch (_) {}
      }
    }
  };

  // Listen to external fullscreen changes (like Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Desktop keyboard shortcuts (F: Fullscreen, T: Theater, Space/K: Play/Pause, M: Mute, Arrows: Channels)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "t" || e.key === "T") {
        if (onToggleTheaterMode) {
          e.preventDefault();
          onToggleTheaterMode();
        }
      } else if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlayback();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "ArrowRight") {
        if (onNextChannel) {
          e.preventDefault();
          onNextChannel();
        }
      } else if (e.key === "ArrowLeft") {
        if (onPrevChannel) {
          e.preventDefault();
          onPrevChannel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isMuted, onNextChannel, onPrevChannel, onToggleTheaterMode]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const changeQuality = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentQuality(levelIndex);
    setShowQualityMenu(false);
  };

  const toggleAspectRatio = () => {
    if (aspectRatio === "video") setAspectRatio("contain");
    else if (aspectRatio === "contain") setAspectRatio("cover");
    else setAspectRatio("video");
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP error:", err);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;

    // Double tap detected (within 320ms and within 80px distance)
    if (timeDiff < 320 && Math.abs(touchX - lastTapRef.current.x) < 80) {
      if (touchX < rect.width * 0.45 && onPrevChannel) {
        onPrevChannel();
        setTapRipple("prev");
        setTimeout(() => setTapRipple(null), 700);
      } else if (touchX > rect.width * 0.55 && onNextChannel) {
        onNextChannel();
        setTapRipple("next");
        setTimeout(() => setTapRipple(null), 700);
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: touchX };
      resetControlsTimer();
    }
  };

  return (
    <div 
      id="video_player_container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={resetControlsTimer}
      onMouseLeave={handleMouseLeave}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full overflow-hidden bg-frosted-card border shadow-2xl transition-all duration-300 select-none touch-manipulation ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none w-screen h-screen"
          : isTheaterMode
            ? "aspect-video max-h-[78vh] 2xl:max-h-[82vh] rounded-2xl mx-auto border-frosted-medium hover:border-toffee-accent/30"
            : "aspect-video rounded-2xl border-frosted-medium hover:border-toffee-accent/20"
      } ${
        isPlaying && !showControls ? "cursor-none" : "cursor-default"
      }`}
    >
      {channel ? (
        <>
          {/* Main Video Element */}
          <video
            id="toffee_video_stream"
            ref={videoRef}
            className={`w-full h-full bg-black transition-all ${
              aspectRatio === "video" ? "object-fill" : aspectRatio === "contain" ? "object-contain" : "object-cover"
            }`}
            onClick={togglePlayback}
            playsInline
          />

          {/* Double-tap visual feedback ripples */}
          {tapRipple === "prev" && (
            <div className="absolute inset-y-0 left-0 w-1/2 flex items-center justify-start pl-8 bg-gradient-to-r from-toffee-accent/25 to-transparent pointer-events-none z-30 animate-pulse">
              <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/20 text-white shadow-xl">
                <SkipBack size={18} className="text-toffee-accent" />
                <span className="text-xs font-display font-bold">আগের চ্যানেল</span>
              </div>
            </div>
          )}

          {tapRipple === "next" && (
            <div className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-end pr-8 bg-gradient-to-l from-toffee-accent/25 to-transparent pointer-events-none z-30 animate-pulse">
              <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/20 text-white shadow-xl">
                <span className="text-xs font-display font-bold">পরের চ্যানেল</span>
                <SkipForward size={18} className="text-toffee-accent" />
              </div>
            </div>
          )}

          {/* Buffering Overlay */}
          {isBuffering && !loadError && (
            <div id="player_loader" className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md z-10">
              <div className="w-12 h-12 border-4 border-toffee-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white/80 font-sans tracking-wide text-sm font-medium animate-pulse">
                Proxying secure feed for {channel.name}...
              </p>
            </div>
          )}

          {/* Error Overlay */}
          {loadError && (
            <div id="player_error_state" className="absolute inset-0 flex flex-col items-center justify-center bg-[#08090d]/80 backdrop-blur-lg z-20 px-6 text-center border border-frosted-medium">
              <AlertCircle size={44} className="text-toffee-accent mb-4 animate-bounce" />
              <h3 className="text-white font-display text-lg font-bold mb-2">Streaming Temporarily Unavailable</h3>
              <p className="text-white/60 font-sans text-xs max-w-md mb-6 leading-relaxed max-h-[140px] overflow-y-auto">
                {loadError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  id="player_retry_btn"
                  onClick={handleRetry}
                  className="flex items-center gap-2 bg-toffee-accent text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition hover:bg-toffee-accent/80 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  Retry Stream
                </button>
                <button
                  id="player_switch_mode_btn"
                  onClick={() => {
                    setStreamMode(prev => prev === "proxy" ? "direct" : "proxy");
                    setLoadError(null);
                    setIsBuffering(true);
                  }}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition border border-white/15 active:scale-95 cursor-pointer"
                >
                  Switch to {streamMode === "proxy" ? "Direct Stream" : "Proxy Stream"}
                </button>
              </div>
            </div>
          )}

          {/* Video Player controls custom design Overlay */}
          <div 
            id="player_controls_overlay" 
            onClick={resetControlsTimer}
            className={`absolute inset-0 flex flex-col justify-between p-2.5 sm:p-4 bg-gradient-to-t from-black/90 via-transparent to-black/80 transition-opacity duration-300 z-10 font-sans ${
              showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            
            {/* Top header: Channel Info */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {channel.logo ? (
                  <img
                    id="player_header_logo"
                    src={channel.logo}
                    alt={channel.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-md bg-black/50 p-1 border border-white/10 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-toffee-accent/15 flex items-center justify-center border border-toffee-accent/20 shrink-0">
                    <Tv size={16} className="text-toffee-accent" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 id="player_current_name" className="text-white font-display font-semibold text-xs sm:text-base leading-tight truncate">
                    {channel.name}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <span className="live-pulse w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-toffee-accent animate-pulse shrink-0" />
                    <span className="text-white/60 text-[9px] sm:text-[10px] uppercase font-mono tracking-wider font-semibold truncate">
                      {channel.category} • Live
                    </span>
                  </div>
                </div>
              </div>

              {/* Stream mode & latency indicator */}
              <button
                id="player_stream_mode_toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setStreamMode(prev => prev === "proxy" ? "direct" : "proxy");
                }}
                className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono px-2 py-0.5 sm:py-1 rounded-sm border transition cursor-pointer shrink-0 ${
                  streamMode === "proxy"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-400/25 hover:bg-emerald-500/20"
                    : "text-sky-400 bg-sky-500/10 border-sky-400/25 hover:bg-sky-500/20"
                }`}
                title={`Click to switch mode (Current: ${streamMode.toUpperCase()})`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${streamMode === "proxy" ? "bg-emerald-400 animate-ping" : "bg-sky-400"}`} />
                <span>{streamMode === "proxy" ? "PROXY STREAM" : "DIRECT STREAM"}</span>
              </button>
            </div>

            {/* Middle part - Buffer overlay trigger placeholder or info */}
            <div className="flex justify-center items-center gap-4 sm:gap-6">
              {/* Previous Channel button */}
              {onPrevChannel && (
                <button 
                  id="player_center_prev_btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrevChannel();
                    resetControlsTimer();
                  }}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition hover:bg-white/20 active:scale-90 duration-200 cursor-pointer shadow-lg touch-manipulation"
                  title="Previous Channel"
                >
                  <SkipBack size={18} />
                </button>
              )}

              {/* Play/Pause giant overlay */}
              <button 
                id="player_center_play_btn"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayback();
                }}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-toffee-accent/90 hover:bg-toffee-accent backdrop-blur-md flex items-center justify-center text-white transition active:scale-90 duration-200 cursor-pointer shadow-xl touch-manipulation"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={22} className="sm:w-7 sm:h-7" /> : <Play size={22} className="sm:w-7 sm:h-7 ml-0.5" />}
              </button>

              {/* Next Channel button */}
              {onNextChannel && (
                <button 
                  id="player_center_next_btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNextChannel();
                    resetControlsTimer();
                  }}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition hover:bg-white/20 active:scale-90 duration-200 cursor-pointer shadow-lg touch-manipulation"
                  title="Next Channel"
                >
                  <SkipForward size={18} />
                </button>
              )}
            </div>

            {/* Bottom Panel controls */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between bg-black/60 backdrop-blur-xl rounded-xl px-2 sm:px-3.5 py-1.5 sm:py-2 border border-white/10 gap-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Previous channel bottom control */}
                  {onPrevChannel && (
                    <button
                      id="player_prev_btn_bottom"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrevChannel();
                      }}
                      className="p-1.5 rounded-lg text-white/75 hover:text-toffee-accent hover:bg-white/10 transition active:scale-90 cursor-pointer touch-manipulation"
                      title="Previous Channel"
                    >
                      <SkipBack size={15} />
                    </button>
                  )}

                  {/* Play Pause */}
                  <button
                    id="player_play_pause_btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayback();
                    }}
                    className="p-1.5 rounded-lg text-white hover:text-toffee-accent hover:bg-white/10 transition active:scale-90 cursor-pointer touch-manipulation"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                  </button>

                  {/* Next channel bottom control */}
                  {onNextChannel && (
                    <button
                      id="player_next_btn_bottom"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNextChannel();
                      }}
                      className="p-1.5 rounded-lg text-white/75 hover:text-toffee-accent hover:bg-white/10 transition active:scale-90 cursor-pointer touch-manipulation"
                      title="Next Channel"
                    >
                      <SkipForward size={15} />
                    </button>
                  )}

                  {/* Volume Control */}
                  <div className="flex items-center gap-1">
                    <button
                      id="player_mute_btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition active:scale-90 cursor-pointer touch-manipulation"
                    >
                      {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                    </button>
                    <input
                      id="player_volume_slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      onClick={(e) => e.stopPropagation()}
                      className="hidden md:block w-14 lg:w-18 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-toffee-accent"
                    />
                  </div>

                  {/* Aspect Ratio Toggle */}
                  <button
                    id="player_ratio_btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAspectRatio();
                    }}
                    className="flex items-center gap-1 text-[11px] text-white/80 hover:text-white transition px-2 py-1 rounded bg-white/5 hover:bg-white/10 active:scale-95 touch-manipulation"
                    title="Toggle Aspect Ratio"
                  >
                    <Expand size={11} />
                    <span className="capitalize text-[10px] font-mono tracking-wider">
                      {aspectRatio}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Quality levels selector */}
                  {qualityLevels.length > 0 && (
                    <div className="relative">
                      <button
                        id="player_quality_menu_btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowQualityMenu(!showQualityMenu);
                        }}
                        className="flex items-center gap-1 text-[11px] text-white/80 hover:text-white transition px-2 py-1 rounded bg-white/5 hover:bg-white/10 active:scale-95 touch-manipulation"
                        title="Stream Quality"
                      >
                        <Layers size={12} />
                        <span className="text-[10px] font-mono">
                          {currentQuality === -1 ? "Auto" : `${qualityLevels[currentQuality]?.height}p`}
                        </span>
                      </button>

                      {/* Dropdown Quality menu overlay */}
                      {showQualityMenu && (
                        <div id="player_quality_dropdown" className="absolute bottom-10 right-0 mb-2 w-32 sm:w-36 max-h-48 overflow-y-auto bg-[#13151f] border border-white/15 backdrop-blur-xl rounded-lg shadow-2xl py-1 z-30 flex flex-col font-sans">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              changeQuality(-1);
                            }}
                            className="flex items-center justify-between text-left px-3 py-1.5 text-xs text-white hover:bg-toffee-accent/20 transition-all font-medium touch-manipulation"
                          >
                            <span>Auto</span>
                            {currentQuality === -1 && <Check size={12} className="text-toffee-accent" />}
                          </button>
                          {qualityLevels.map((lvl, index) => (
                            <button
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation();
                                changeQuality(index);
                              }}
                              className="flex items-center justify-between text-left px-3 py-1.5 text-xs text-white hover:bg-toffee-accent/20 transition-all touch-manipulation"
                            >
                              <span>{lvl.height}p</span>
                              {currentQuality === index && <Check size={12} className="text-toffee-accent" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reconnect stream button */}
                  <button
                    id="player_reload_btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRetry();
                    }}
                    className="p-1.5 rounded-lg text-white/75 hover:text-toffee-accent hover:bg-white/10 transition active:scale-90 cursor-pointer touch-manipulation"
                    title="Reconnect stream feed"
                  >
                    <RefreshCw size={15} />
                  </button>

                  {/* Picture-in-Picture Button */}
                  {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
                    <button
                      id="player_pip_btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePiP();
                      }}
                      className="p-1.5 rounded-lg text-white/75 hover:text-toffee-accent hover:bg-white/10 transition active:scale-90 cursor-pointer touch-manipulation"
                      title="Picture in Picture"
                    >
                      <PictureInPicture size={15} />
                    </button>
                  )}

                  {/* Theater / Cinema Mode (Desktop) */}
                  {onToggleTheaterMode && (
                    <button
                      id="player_theater_btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTheaterMode();
                      }}
                      className={`hidden lg:flex items-center justify-center p-1.5 rounded-lg transition active:scale-90 cursor-pointer touch-manipulation ${
                        isTheaterMode 
                          ? "text-toffee-accent bg-white/15" 
                          : "text-white/75 hover:text-toffee-accent hover:bg-white/10"
                      }`}
                      title={isTheaterMode ? "Exit Theater Mode (নরমাল ভিউ) [T]" : "Theater Mode / Full Width (থিয়েটার ভিউ) [T]"}
                    >
                      <Monitor size={15} />
                    </button>
                  )}

                  {/* Fullscreen control */}
                  <button
                    id="player_fullscreen_btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="p-1.5 rounded-lg text-white hover:text-toffee-accent hover:bg-white/10 transition active:scale-90 cursor-pointer touch-manipulation"
                    title={isFullscreen ? "Exit Fullscreen [F]" : "Full Screen [F]"}
                  >
                    {isFullscreen ? <Shrink size={17} /> : <Expand size={17} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div id="player_no_channel_state" className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-frosted-card border border-frosted-medium">
          <div className="w-16 h-16 rounded-full bg-toffee-accent/10 border border-toffee-accent/20 flex items-center justify-center mb-4 text-toffee-accent animate-pulse">
            <Tv size={32} />
          </div>
          <h2 className="text-white text-lg font-display font-semibold mb-1">Sabbir TV Stream Engine Ready</h2>
          <p className="text-white/40 text-xs max-w-sm mb-4 leading-relaxed font-sans">
            Please choose any live sports, news, entertainment, or kids channel from the dashboard below to initialize the server credentials.
          </p>
        </div>
      )}
    </div>
  );
}
