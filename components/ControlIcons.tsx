import React from 'react';
import { GamePhase } from '@/lib/types';

type IconProps = {
  className?: string;
  title?: string;
  'aria-hidden'?: boolean;
};

function Svg({
  className,
  title,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 15l-6-6-6 6" />
    </Svg>
  );
}

export function RoundDialIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
      <path d="M9 3h6" />
    </Svg>
  );
}

export function SwordIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Gladius-style sword (clean silhouette) */}
      {/* Blade */}
      <path d="M12 2l3 4v11l-3 2-3-2V6l3-4z" />
      {/* Guard (short + chunky) */}
      <path d="M8 16h8" />
      {/* Handle (short) + pommel */}
      <path d="M11 18v3h2v-3" />
      <path d="M11 19h2" />
      <circle cx="12" cy="22" r="0.75" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />
      <path d="M12 6v14" />
    </Svg>
  );
}

export function CommandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M4.9 4.9l2.1 2.1" />
      <path d="M17 17l2.1 2.1" />
      <path d="M4.9 19.1L7 17" />
      <path d="M17 7l2.1-2.1" />
    </Svg>
  );
}

export function MovementIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
      <path d="M11 8H7" />
      <path d="M11 16H7" />
    </Svg>
  );
}

export function ShootingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
    </Svg>
  );
}

export function ChargeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2L4 14h7l-1 8 10-14h-7z" />
    </Svg>
  );
}

export function FightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4l10 10" />
      <path d="M17 4L7 14" />
      <path d="M6 15l-2 2" />
      <path d="M18 15l2 2" />
    </Svg>
  );
}

export function PhaseIcon({ phase, ...props }: IconProps & { phase: GamePhase }) {
  switch (phase) {
    case 'Command':
      return <CommandIcon {...props} />;
    case 'Movement':
      return <MovementIcon {...props} />;
    case 'Shooting':
      return <ShootingIcon {...props} />;
    case 'Charge':
      return <ChargeIcon {...props} />;
    case 'Fight':
      return <FightIcon {...props} />;
    default:
      return <CommandIcon {...props} />;
  }
}


