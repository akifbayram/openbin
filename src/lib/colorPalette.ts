export interface ColorPreset {
  key: string;
  label: string;
  bg: string;
  bgDark: string;
  dot: string;
}

export const COLOR_PALETTE: ColorPreset[] = [
  { key: 'red',    label: 'Red',    bg: 'rgba(239, 68, 68, 0.12)',  bgDark: 'rgba(239, 68, 68, 0.18)',  dot: '#ef4444' },
  { key: 'orange', label: 'Orange', bg: 'rgba(249, 115, 22, 0.12)', bgDark: 'rgba(249, 115, 22, 0.18)', dot: '#f97316' },
  { key: 'amber',  label: 'Amber',  bg: 'rgba(245, 158, 11, 0.12)', bgDark: 'rgba(245, 158, 11, 0.18)', dot: '#f59e0b' },
  { key: 'green',  label: 'Green',  bg: 'rgba(34, 197, 94, 0.12)',  bgDark: 'rgba(34, 197, 94, 0.18)',  dot: '#22c55e' },
  { key: 'teal',   label: 'Teal',   bg: 'rgba(20, 184, 166, 0.12)', bgDark: 'rgba(20, 184, 166, 0.18)', dot: '#14b8a6' },
  { key: 'blue',   label: 'Blue',   bg: 'rgba(59, 130, 246, 0.12)', bgDark: 'rgba(59, 130, 246, 0.18)', dot: '#3b82f6' },
  { key: 'indigo', label: 'Indigo', bg: 'rgba(99, 102, 241, 0.12)', bgDark: 'rgba(99, 102, 241, 0.18)', dot: '#6366f1' },
  { key: 'purple', label: 'Purple', bg: 'rgba(168, 85, 247, 0.12)', bgDark: 'rgba(168, 85, 247, 0.18)', dot: '#a855f7' },
  { key: 'pink',   label: 'Pink',   bg: 'rgba(236, 72, 153, 0.12)', bgDark: 'rgba(236, 72, 153, 0.18)', dot: '#ec4899' },
  { key: 'gray',   label: 'Gray',   bg: 'rgba(107, 114, 128, 0.12)', bgDark: 'rgba(107, 114, 128, 0.18)', dot: '#6b7280' },
];

export function getColorPreset(key: string): ColorPreset | undefined {
  return COLOR_PALETTE.find((c) => c.key === key);
}
