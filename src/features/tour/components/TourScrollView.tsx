import { createContext, useRef, useState } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import type { Scroller } from '@/features/tour/lib/tour';

export const TourScrollContext = createContext<Scroller | null>(null);

/** A ScrollView that the guided tour can scroll to bring a step's target into view. */
export function TourScrollView({ onScroll, children, ...props }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [scroller] = useState<Scroller>(() => ({
    scrollBy: (dy) => ref.current?.scrollTo({ y: Math.max(offset.current + dy, 0), animated: true }),
  }));
  return (
    <TourScrollContext.Provider value={scroller}>
      <ScrollView
        ref={ref}
        scrollEventThrottle={16}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        {...props}
      >
        {children}
      </ScrollView>
    </TourScrollContext.Provider>
  );
}
