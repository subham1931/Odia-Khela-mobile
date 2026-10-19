# Odia Khela — Mobile

Expo (React Native) app for **Odia Khela** heritage indoor games. Shares the pure TypeScript rules engine with [`../odiakhela-web`](../odiakhela-web).

## Status

| Game | Status |
|------|--------|
| **Kasadi** | Playable (vs AI or pass & play) |
| Bagha Chheli | Coming soon |
| Chowka Bara | Coming soon |
| Dash-guti | Coming soon |
| Lamlameta | Coming soon |
| Kalah | Coming soon |

## Run

```bash
cd odiakhela-mobile
npm install
npx expo start
```

Then open in Expo Go, iOS Simulator, or Android emulator.

```bash
npm run typecheck
npm run lint
```

## Layout

```
app/                 Expo Router screens (home → setup → play)
components/          Kasadi board, pits, stores, game chrome
hooks/               useMancalaGame — animates engine SowEvents
lib/                 AI client (main thread), haptics/sound stubs
store/               Zustand settings (AsyncStorage)
constants/           Theme tokens
```

Imports like `@odiakhela/engine/rules` resolve to `../odiakhela-web/engine` via Metro + Babel + TypeScript paths. Keep game rules in the web engine; do not duplicate them here.
