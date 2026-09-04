import React, { useState, useEffect } from "react";
import { Tv } from "lucide-react";
import { Channel } from "../types";
import { getChannelLogo } from "../utils/channelLogos";

interface ChannelLogoProps {
  channel: Channel;
  className?: string;
  imgClassName?: string;
  showInitialsOnFail?: boolean;
}

export default function ChannelLogo({
  channel,
  className = "",
  imgClassName = "max-h-full max-w-full object-contain",
  showInitialsOnFail = true
}: ChannelLogoProps) {
  const [logoSrc, setLogoSrc] = useState<string>(() => getChannelLogo(channel));
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setLogoSrc(getChannelLogo(channel));
    setHasError(false);
  }, [channel.name, channel.logo]);

  const handleError = () => {
    // If external logo failed, try local resolver
    const local = getChannelLogo({ name: channel.name });
    if (logoSrc !== local) {
      setLogoSrc(local);
    } else {
      setHasError(true);
    }
  };

  // Extract 1-3 initials for the channel
  const getInitials = (name: string) => {
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 3).toUpperCase() || "TV";
  };

  if (hasError && showInitialsOnFail) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center p-1 select-none bg-gradient-to-br from-gray-900 to-black rounded-lg border border-white/10 ${className}`}>
        <span className="text-xs sm:text-sm font-black tracking-wider text-toffee-accent font-display">
          {getInitials(channel.name)}
        </span>
        <span className="text-[8px] text-gray-400 font-mono line-clamp-1 max-w-[90%] text-center">
          {channel.name}
        </span>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center relative overflow-hidden ${className}`}>
      <img
        src={logoSrc}
        alt={channel.name}
        className={imgClassName}
        onError={handleError}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  );
}
