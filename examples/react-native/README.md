# Motion for React Native example

An Expo app that runs `motion/react-native` from this repo's built packages.

```bash
# From the repo root
yarn build

# Then here
cd examples/react-native
npm install
npx expo run:ios   # or run:android. Reanimated 4 needs a dev build, not Expo Go
```

Press "Block JS thread for 2s" to busy the JS thread. Animations of values
Motion owns keep playing on the UI thread, while the `onUpdate` box, which
has to run in JS, freezes until JS is free.

`metro.config.js` resolves `motion`, `framer-motion`, `motion-dom` and
`motion-utils` from `../../packages`, and everything they import from this
app's `node_modules`, so there's one copy of React.
