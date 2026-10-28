# Motion for React Native example

An Expo app that runs `motion/react-native` from this repo's built packages.

```bash
# From the repo root
yarn build

# Then here
cd examples/react-native
npm install
```

## Tests

Both run in a Linux container (no simulator needed).

```bash
npm test          # Jest against the real React Native and Reanimated
npm run test:web  # Playwright in Chromium, through react-native-web
```

- **Jest** uses Reanimated's Jest mode (`setUpTests()`), where worklets
  run on the JS thread and fake timers drive frames. `getAnimatedStyle`
  reads what the UI-thread player wrote.
- **Playwright** builds the web export into `dist/`, serves it, and reads
  computed styles. On the web Reanimated runs worklets on the main thread,
  so neither suite proves animations keep running while JS is blocked.
  That needs a device.

## On a device

```bash
npx expo run:ios   # or run:android. Reanimated 4 needs a dev build, not Expo Go
```

Press "Block JS thread for 2s" to busy the JS thread. Animations of values
Motion owns keep playing on the UI thread, while the `onUpdate` box, which
has to run in JS, freezes until JS is free.

`metro.config.js` and `jest.config.js` resolve `motion`, `framer-motion`,
`motion-dom` and `motion-utils` from `../../packages`, and everything they
import from this app's `node_modules`, so there's one copy of React.
