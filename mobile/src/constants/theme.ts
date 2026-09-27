import { Platform } from 'react-native';

/** Exchange-style dark palette. The app is dark-only (see userInterfaceStyle in app.json). */
export const Colors = {
  background: '#0B0E11',
  surface: '#161A1E',
  surfaceRaised: '#1E2329',
  border: '#2B3139',
  text: '#EAECEF',
  textSecondary: '#848E9C',
  textMuted: '#5E6673',
  accent: '#F0B90B',
  up: '#0ECB81',
  down: '#F6465D',
  flat: '#848E9C',
} as const;

export const Fonts = {
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const directionColor = (delta: number | null | undefined) =>
  !delta ? Colors.flat : delta > 0 ? Colors.up : Colors.down;
