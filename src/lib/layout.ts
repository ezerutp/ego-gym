import { useWindowDimensions } from 'react-native';

/** Tablet-sized screens (any orientation) get the side rail and wider layouts. */
export const WIDE_BREAKPOINT = 768;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
