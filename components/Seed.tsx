import Svg, { Defs, Ellipse, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import type { SeedStyle } from '@/store/settings';

export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const PEBBLE_TONES = ['#9aa3a6', '#7d8487', '#b7b0a3', '#6b6f6c', '#a99f90'];

export function Seed({
  style,
  variantSeed,
  size = 14,
}: {
  style: SeedStyle;
  variantSeed: number;
  size?: number;
}) {
  const rot = Math.floor(hash(variantSeed) * 360);
  if (style === 'cowrie') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" style={{ transform: [{ rotate: `${rot}deg` }] }}>
        <Defs>
          <RadialGradient id={`cowrie-${variantSeed}`} cx="40%" cy="35%" r="70%">
            <Stop offset="0%" stopColor="#fffaf0" />
            <Stop offset="60%" stopColor="#efe0c2" />
            <Stop offset="100%" stopColor="#c9ad7f" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="10" cy="10" rx="8.2" ry="6" fill={`url(#cowrie-${variantSeed})`} stroke="#8a7350" strokeWidth="0.6" />
        <Path d="M3.6 10 Q10 8.6 16.4 10" stroke="#5e4a2e" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {[5.5, 8, 10.5, 13].map((x) => (
          <Line key={x} x1={x} y1="9.2" x2={x} y2="10.8" stroke="#6b5636" strokeWidth="0.5" />
        ))}
        <Ellipse cx="8" cy="7" rx="3" ry="1.2" fill="#fff" opacity="0.55" />
      </Svg>
    );
  }
  if (style === 'tamarind') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" style={{ transform: [{ rotate: `${rot}deg` }] }}>
        <Defs>
          <RadialGradient id={`tamarind-${variantSeed}`} cx="35%" cy="30%" r="75%">
            <Stop offset="0%" stopColor="#8a4b2a" />
            <Stop offset="55%" stopColor="#5a2b17" />
            <Stop offset="100%" stopColor="#2e140a" />
          </RadialGradient>
        </Defs>
        <Path
          d="M4 7 Q5 3 11 3.5 Q17 4.5 16.5 10.5 Q16 16.5 10 16.5 Q3.5 16 3.5 11 Z"
          fill={`url(#tamarind-${variantSeed})`}
        />
        <Ellipse cx="9" cy="7" rx="3.2" ry="1.4" fill="#fff" opacity="0.35" />
      </Svg>
    );
  }
  const tone = PEBBLE_TONES[Math.floor(hash(variantSeed + 7) * PEBBLE_TONES.length)];
  const rx = 6.5 + hash(variantSeed + 3) * 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" style={{ transform: [{ rotate: `${rot}deg` }] }}>
      <Defs>
        <RadialGradient id={`pebble-${variantSeed}`} cx="35%" cy="30%" r="80%">
          <Stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="10" cy="10.5" rx={rx} ry="6.2" fill={tone} />
      <Ellipse cx="10" cy="10.5" rx={rx} ry="6.2" fill={`url(#pebble-${variantSeed})`} />
      <Ellipse cx="8" cy="8" rx="2.6" ry="1.2" fill="#fff" opacity="0.45" />
    </Svg>
  );
}
