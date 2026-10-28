const path = require("path")

const packages = path.resolve(__dirname, "../../packages")
const app = (name) => path.join(__dirname, "node_modules", name)

/**
 * Runs motion/react-native from this repo's built packages against the real
 * React Native and Reanimated in Reanimated's Jest mode, where worklets run
 * on the JS thread and fake timers drive frames.
 */
module.exports = {
    preset: "jest-expo/ios",
    resolver: "react-native-reanimated/jest/resolver",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
    moduleNameMapper: {
        "^motion/react-native$": `${packages}/motion/dist/cjs/react-native.js`,
        "^framer-motion/native$": `${packages}/framer-motion/dist/cjs/native.js`,
        "^motion-dom$": `${packages}/motion-dom/dist/cjs/index.js`,
        "^motion-utils$": `${packages}/motion-utils/dist/cjs/index.js`,
        // The built packages resolve these from the repo root, so point them at this app's copies.
        "^(react|react-native|react-native-reanimated|react-native-worklets)$": `${app("$1")}`,
        "^react/(.*)$": `${app("react")}/$1`,
    },
}
