import { useColorScheme } from 'react-native';

const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F3',
  border: '#DDE1E6',
  text: '#15181C',
  textMuted: '#5B6470',
  textFaint: '#8A929C',
  accent: '#0B7A64',
  accentText: '#FFFFFF',
  accentSoft: '#DDF1EB',
  highlight: '#FFF1B8',
  danger: '#B42318',
  dangerSoft: '#FDEBE9',
  warning: '#8A5300',
  warningSoft: '#FFF4E0',
  online: '#15A36E',
  offline: '#C2410C',
};

export type Palette = typeof light;

const dark: Palette = {
  scheme: 'dark',
  bg: '#0E1013',
  surface: '#171A1F',
  surfaceAlt: '#20242A',
  border: '#2B3038',
  text: '#ECEEF1',
  textMuted: '#A2AAB4',
  textFaint: '#737B85',
  accent: '#3FCBA8',
  accentText: '#062A22',
  accentSoft: '#12362E',
  highlight: '#5A4A0B',
  danger: '#FF8A7A',
  dangerSoft: '#3A1814',
  warning: '#F2B45C',
  warningSoft: '#352812',
  online: '#34D399',
  offline: '#FB923C',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const text = { title: 30, h2: 17, body: 16, small: 14, tiny: 12 } as const;

/**
 * Builds themed styles once per palette and returns a hook that picks them.
 * The factory should return `StyleSheet.create(...)`, which is what gives
 * style literals like `fontWeight: '700'` their precise types.
 */
export function makeStyles<T>(factory: (c: Palette) => T) {
  const cache = new Map<Palette, T>();
  return function useStyles(): T {
    const palette = useTheme();
    let styles = cache.get(palette);
    if (styles === undefined) {
      styles = factory(palette);
      cache.set(palette, styles);
    }
    return styles;
  };
}
