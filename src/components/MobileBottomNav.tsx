import React from "react";
import { Tv, Trophy, Star, Clock, Radio } from "lucide-react";

interface MobileBottomNavProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  favoritesCount: number;
  historyCount: number;
}

export default function MobileBottomNav({
  activeCategory,
  onSelectCategory,
  favoritesCount,
  historyCount
}: MobileBottomNavProps) {
  const tabs = [
    { id: "All", label: "লাইভ টিভি", icon: Tv },
    { id: "Sports Channels", label: "খেলা", icon: Trophy },
    { id: "বাংলাদেশী চ্যানেল", label: "বাংলা", icon: Radio },
    { id: "Favorites", label: "প্রিয়", icon: Star, count: favoritesCount },
    { id: "History", label: "হিস্ট্রি", icon: Clock, count: historyCount }
  ];

  return (
    <nav 
      id="mobile_bottom_nav" 
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0c13]/95 backdrop-blur-2xl border-t border-white/10 px-2 pt-1.5 pb-safe pb-2 shadow-[0_-8px_25px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;

          return (
            <button
              key={tab.id}
              id={`mobile_tab_${tab.id.replace(/\s+/g, '_')}`}
              type="button"
              onClick={() => {
                onSelectCategory(tab.id);
                // Scroll channel list smoothly into view on mobile
                const gridEl = document.getElementById("channel_directory_section");
                if (gridEl) {
                  gridEl.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={`relative flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all duration-200 touch-manipulation active:scale-90 ${
                isActive ? "text-toffee-accent font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? "text-toffee-accent" : "text-gray-400"} />
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-toffee-accent text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-md">
                    {tab.count}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-display tracking-tight whitespace-nowrap ${
                isActive ? "text-toffee-accent font-bold scale-105" : "text-gray-400 font-normal"
              }`}>
                {tab.label}
              </span>

              {/* Active pill glow under tab */}
              {isActive && (
                <div className="w-4 h-1 bg-toffee-accent rounded-full mt-0.5 shadow-sm shadow-toffee-accent" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
