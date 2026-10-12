import { useColorScheme } from 'react-native';

const lightColors = {
  primary: '#0B7A5C',
  primaryDark: '#065A43',
  primarySoft: '#E3F4EE',
  ink: '#101828',
  text: '#344054',
  muted: '#667085',
  faint: '#98A2B3',
  border: '#EAECF0',
  background: '#F5F6F8',
  surface: '#FFFFFF',
  warning: '#DC6803',
  warningSoft: '#FEF0C7',
  danger: '#D92D20',
  dangerSoft: '#FEE4E2',
  info: '#1570EF',
  infoSoft: '#D1E9FF',
  /** Text and icons placed on top of `primary`; white in both schemes. */
  white: '#FFFFFF',
  overlay: 'rgba(16, 24, 40, 0.55)',
};

export type Colors = typeof lightColors;

const darkColors: Colors = {
  primary: '#13A57D',
  primaryDark: '#7BE0BF',
  primarySoft: '#10302A',
  ink: '#F5F5F6',
  text: '#CECFD2',
  muted: '#94969C',
  faint: '#6C717C',
  border: '#262B36',
  background: '#0C111D',
  surface: '#161B26',
  warning: '#F79009',
  warningSoft: '#3A2410',
  danger: '#F97066',
  dangerSoft: '#3B1513',
  info: '#53B1FD',
  infoSoft: '#102A43',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

function buildTheme(colors: Colors, dark: boolean) {
  return {
    dark,
    colors,
    font: {
      title: { fontSize: 28, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.5 },
      h2: { fontSize: 20, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.2 },
      h3: { fontSize: 16, fontWeight: '700' as const, color: colors.ink },
      body: { fontSize: 15, color: colors.text },
      small: { fontSize: 13, color: colors.muted },
      tiny: { fontSize: 11, color: colors.muted, fontWeight: '600' as const, letterSpacing: 0.4 },
    },
    shadow: {
      shadowColor: '#000000',
      shadowOpacity: dark ? 0.3 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      // Elevation shadows are barely visible on dark surfaces and look muddy; borders do the work there.
      elevation: dark ? 0 : 2,
    },
  };
}

export type Theme = ReturnType<typeof buildTheme>;

export const lightTheme = buildTheme(lightColors, false);
export const darkTheme = buildTheme(darkColors, true);

/** Follows the phone's light/dark setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** Builds a style sheet per theme once and returns the one matching the current scheme. */
export function makeStyles<T>(factory: (theme: Theme) => T) {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = factory(theme);
      cache.set(theme, styles);
    }
    return styles;
  };
}
