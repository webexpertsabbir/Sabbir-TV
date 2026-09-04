import React from "react";
import { motion } from "motion/react";
import { Tv, Star, Radio } from "lucide-react";
import { Channel } from "../types";
import ChannelLogo from "./ChannelLogo";

interface ChannelCardProps {
  key?: React.Key;
  channel: Channel;
  isSelected: boolean;
  isFavorite: boolean;
  isPlaying?: boolean;
  viewMode: "grid" | "list";
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channelName: string, e: React.MouseEvent) => void;
  index: number;
}

export default function ChannelCard({
  channel,
  isSelected,
  isFavorite,
  isPlaying = false,
  viewMode,
  onSelect,
  onToggleFavorite,
  index
}: ChannelCardProps) {
  if (viewMode === "grid") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.15) }}
        onClick={() => onSelect(channel)}
        className={`group relative flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl border cursor-pointer select-none transition-all duration-200 touch-manipulation active:scale-95 ${
          isSelected
            ? "bg-gradient-to-b from-toffee-accent/20 to-black/80 border-toffee-accent shadow-lg shadow-toffee-accent/20 ring-1 ring-toffee-accent/50"
            : "bg-frosted border-frosted-light hover:border-frosted-strong hover:bg-frosted-card"
        }`}
      >
        {/* Top bar inside card: Live badge & Favorite button */}
        <div className="flex items-center justify-between w-full mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-toffee-accent animate-ping" : "bg-emerald-500"}`} />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white/70">
              {isSelected ? "PLAYING" : "LIVE"}
            </span>
          </div>

          <button
            id={`fav_grid_btn_${index}`}
            type="button"
            onClick={(e) => onToggleFavorite(channel.name, e)}
            className="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-toffee-gold transition active:scale-90"
            aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          >
            <Star size={15} className={isFavorite ? "fill-toffee-gold text-toffee-gold" : "text-gray-500"} />
          </button>
        </div>

        {/* Center Logo */}
        <div className="relative w-full aspect-video sm:h-20 flex items-center justify-center bg-black/40 rounded-xl p-2 border border-white/5 my-1 overflow-hidden">
          <ChannelLogo
            channel={channel}
            imgClassName="max-h-full max-w-full object-contain filter group-hover:scale-110 transition duration-300 drop-shadow-md"
          />

          {/* Equalizer animation overlay when selected */}
          {isSelected && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center gap-1">
              <div className="w-1 bg-toffee-accent rounded-full eq-bar-1" />
              <div className="w-1 bg-toffee-accent rounded-full eq-bar-2" />
              <div className="w-1 bg-toffee-accent rounded-full eq-bar-3" />
            </div>
          )}
        </div>

        {/* Bottom Title & Category */}
        <div className="mt-2 text-left">
          <h4 className={`text-xs font-bold font-display line-clamp-1 leading-snug ${
            isSelected ? "text-toffee-accent font-black" : "text-white group-hover:text-toffee-accent transition"
          }`}>
            {channel.name}
          </h4>
          <span className="text-[10px] text-gray-400 font-mono line-clamp-1 mt-0.5">
            {channel.category}
          </span>
        </div>
      </motion.div>
    );
  }

  // LIST VIEW
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.15) }}
      onClick={() => onSelect(channel)}
      className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 touch-manipulation active:scale-[0.98] ${
        isSelected
          ? "bg-frosted-active border-toffee-accent/60 shadow-md shadow-toffee-accent/10 ring-1 ring-toffee-accent/30"
          : "bg-frosted border-frosted-light hover:border-frosted-medium hover:bg-frosted-card"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Channel Logo thumbnail */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-black/40 rounded-lg p-1.5 border border-white/5 flex items-center justify-center relative overflow-hidden">
          <ChannelLogo
            channel={channel}
            imgClassName="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
          />

          {isSelected && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-0.5">
              <div className="w-0.5 bg-toffee-accent rounded-full eq-bar-1" />
              <div className="w-0.5 bg-toffee-accent rounded-full eq-bar-2" />
              <div className="w-0.5 bg-toffee-accent rounded-full eq-bar-3" />
            </div>
          )}
        </div>

        {/* Channel Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className={`text-xs sm:text-sm font-bold font-display truncate leading-tight ${
              isSelected ? "text-toffee-accent" : "text-white group-hover:text-toffee-accent transition"
            }`}>
              {channel.name}
            </h4>
            {isSelected && (
              <span className="w-1.5 h-1.5 rounded-full bg-toffee-accent animate-ping shrink-0" />
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono truncate block mt-0.5">
            {channel.category}
          </span>
        </div>
      </div>

      {/* Right controls: Favorite Star */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button
          id={`fav_list_btn_${index}`}
          type="button"
          onClick={(e) => onToggleFavorite(channel.name, e)}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-toffee-gold hover:bg-white/10 transition active:scale-90"
          aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
        >
          <Star size={16} className={isFavorite ? "fill-toffee-gold text-toffee-gold" : "text-gray-500"} />
        </button>
      </div>
    </motion.div>
  );
}
