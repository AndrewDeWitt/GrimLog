'use client';

import { useState } from 'react';
import FactionIcon from '@/components/FactionIcon';

interface FactionIconImageProps {
  factionName: string;
  iconUrl?: string | null;
  className?: string;
}

/**
 * Renders a faction icon from a custom URL with fallback to the built-in SVG icons.
 * If the custom URL fails to load, it gracefully falls back to FactionIcon.
 */
export default function FactionIconImage({
  factionName,
  iconUrl,
  className = 'w-5 h-5',
}: FactionIconImageProps) {
  const [hasError, setHasError] = useState(false);

  // Use custom URL if provided and hasn't errored
  if (iconUrl && !hasError) {
    return (
      <img
        src={iconUrl}
        alt={factionName}
        className={`${className} object-contain brightness-125 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]`}
        onError={() => setHasError(true)}
      />
    );
  }

  // Fallback to built-in SVG icon with enhanced visibility
  return (
    <FactionIcon
      factionName={factionName}
      className={`${className} text-green-400 drop-shadow-[0_0_1px_rgba(34,197,94,0.5)]`}
    />
  );
}
