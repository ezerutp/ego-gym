import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { TourScrollContext } from '@/features/tour/components/TourScrollView';
import { registerTarget } from '@/features/tour/lib/tour';

/** Marks a piece of UI that a guided tour step can point at. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const scroller = useContext(TourScrollContext);
  useEffect(() => registerTarget(id, ref, scroller), [id, scroller]);
  return (
    // collapsable={false} keeps the wrapper as a real native view so it can be measured.
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
