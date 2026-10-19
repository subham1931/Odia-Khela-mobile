import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '@/constants/theme';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Matches the web landing header in odiakhela-web/app/page.tsx.
 * Glow mirrors .hero-glow: soft radial brass wash (not a hard pill).
 */
export function HeroHeader() {
  const { width } = useWindowDimensions();
  const headerY = useSharedValue(18);
  const headerOp = useSharedValue(0);
  const eyebrowOp = useSharedValue(0);
  const taglineOp = useSharedValue(0);
  const taglineY = useSharedValue(10);
  const ruleScale = useSharedValue(0);
  const glowOp = useSharedValue(0.55);

  useEffect(() => {
    headerOp.value = withTiming(1, { duration: 650, easing: EASE });
    headerY.value = withTiming(0, { duration: 650, easing: EASE });
    eyebrowOp.value = withDelay(150, withTiming(1, { duration: 800, easing: EASE }));
    taglineOp.value = withDelay(280, withTiming(1, { duration: 550, easing: EASE }));
    taglineY.value = withDelay(280, withTiming(0, { duration: 550, easing: EASE }));
    ruleScale.value = withDelay(450, withTiming(1, { duration: 700, easing: EASE }));
    glowOp.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [eyebrowOp, glowOp, headerOp, headerY, ruleScale, taglineOp, taglineY]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOp.value,
    transform: [{ translateY: headerY.value }],
  }));
  const eyebrowStyle = useAnimatedStyle(() => ({ opacity: eyebrowOp.value }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOp.value,
    transform: [{ translateY: taglineY.value }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: ruleScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOp.value }));

  const glowW = width;
  const glowH = 220;

  return (
    <Animated.View style={[styles.wrap, headerStyle]}>
      <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
        <Svg width={glowW} height={glowH}>
          <Defs>
            <RadialGradient id="heroBrass" cx="50%" cy="28%" rx="55%" ry="48%">
              <Stop offset="0%" stopColor="rgb(201, 162, 79)" stopOpacity="0.18" />
              <Stop offset="55%" stopColor="rgb(201, 162, 79)" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="rgb(201, 162, 79)" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="heroWarm" cx="78%" cy="42%" rx="38%" ry="32%">
              <Stop offset="0%" stopColor="rgb(205, 184, 145)" stopOpacity="0.07" />
              <Stop offset="100%" stopColor="rgb(205, 184, 145)" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={glowW / 2} cy={glowH * 0.32} rx={glowW * 0.55} ry={glowH * 0.42} fill="url(#heroBrass)" />
          <Ellipse cx={glowW * 0.78} cy={glowH * 0.4} rx={glowW * 0.32} ry={glowH * 0.28} fill="url(#heroWarm)" />
        </Svg>
      </Animated.View>

      <Animated.Text style={[styles.eyebrow, eyebrowStyle]}>Heritage indoor games</Animated.Text>

      <Text style={styles.brand}>Odia Khela</Text>

      <Animated.Text style={[styles.tagline, taglineStyle]}>
        Step into Odisha's timeless gaming heritage. Master ancient cowrie strategies in Kasadi, outsmart
        predators in Baag-Chhel, capture paths in Dash Guti, and race in Chauka Bara—tradition reborn for
        mobile play.
      </Animated.Text>

      <Animated.View style={[styles.ruleTrack, ruleStyle]}>
        <LinearGradient
          colors={['transparent', colors.brass, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.ruleGradient}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 8,
  },
  glowWrap: {
    position: 'absolute',
    top: -36,
    left: -20,
    right: -20,
    height: 220,
    alignItems: 'center',
  },
  eyebrow: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3.8,
    textTransform: 'uppercase',
    color: colors.brass,
    fontFamily: 'SourceSans3_600SemiBold',
  },
  brand: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 52,
    lineHeight: 56,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(245, 230, 200, 0.65)',
    paddingHorizontal: 4,
    fontFamily: 'SourceSans3_400Regular',
  },
  ruleTrack: {
    marginTop: 24,
    marginBottom: 12,
    width: 96,
    height: 1,
    overflow: 'hidden',
  },
  ruleGradient: { width: '100%', height: 1 },
});
