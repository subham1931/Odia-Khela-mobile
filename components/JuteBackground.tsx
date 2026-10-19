import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '@/constants/theme';

/**
 * Soft woven jute grid — atmosphere only. Keep opacity low so UI text
 * clearly sits above the background (same idea as web globals.css).
 */
export function JuteBackground() {
  const { width, height } = useWindowDimensions();

  const { horiz, vert } = useMemo(() => {
    const step = 6;
    const h: number[] = [];
    const v: number[] = [];
    for (let y = 0; y < height + step; y += step) h.push(y);
    for (let x = 0; x < width + step; x += step) v.push(x);
    return { horiz: h, vert: v };
  }, [width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
      {/* Subtle bottom vignette — no big top wash that fights the hero text */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.4,
          backgroundColor: colors.bgDeep,
          opacity: 0.45,
        }}
      />

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {horiz.map((y) => (
          <Rect
            key={`h-${y}`}
            x={0}
            y={y}
            width={width}
            height={1}
            fill="rgba(205, 184, 145, 0.045)"
          />
        ))}
        {vert.map((x) => (
          <Rect
            key={`v-${x}`}
            x={x}
            y={0}
            width={1}
            height={height}
            fill="rgba(205, 184, 145, 0.038)"
          />
        ))}
      </Svg>
    </View>
  );
}
