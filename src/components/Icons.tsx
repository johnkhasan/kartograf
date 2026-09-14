interface IconProps {
  size?: number;
}

const S = (p: IconProps) => p.size ?? 18;

export const IconLocation = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 21s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 12 3.5 6.5 6.5 0 0 1 18.5 10c0 4.8-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const IconTheme = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.2A4.8 4.8 0 0 0 22 9.7C21.3 5.9 17 3 12 3z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="15" cy="7.5" r="1" fill="currentColor" />
  </svg>
);

export const IconLayout = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <line x1="5" y1="16" x2="19" y2="16" />
  </svg>
);

export const IconType = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 6V4h14v2" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="9" y1="20" x2="15" y2="20" />
  </svg>
);

export const IconLayers = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const IconMarker = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 21s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 12 3.5 6.5 6.5 0 0 1 18.5 10c0 4.8-6.5 11-6.5 11z" />
    <line x1="12" y1="7.5" x2="12" y2="12.5" />
    <line x1="9.5" y1="10" x2="14.5" y2="10" />
  </svg>
);

export const IconRoute = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
  </svg>
);

export const IconSettings = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconDownload = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const IconCrosshair = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="7" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

export const IconClose = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="19" y1="5" x2="5" y2="19" />
  </svg>
);

export const IconUndo = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const IconRedo = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);

export const IconEdit = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const IconShare = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <line x1="8.2" y1="10.8" x2="15.8" y2="6.2" />
    <line x1="8.2" y1="13.2" x2="15.8" y2="17.8" />
  </svg>
);

export const IconLogo = (p: IconProps) => (
  <svg width={S(p)} height={S(p)} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="2.5" width="19" height="19" rx="4" stroke="#5eb1d6" strokeWidth="1.6" />
    <path d="M6 16l4-8 3 5 2-3 3 6" stroke="#e3b04b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
