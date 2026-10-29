import { render } from "@testing-library/react-native"
import { motion } from "motion/react-native"

/**
 * On a device, Reanimated ignores useAnimatedStyle dependencies and warns
 * when they're passed, so they should only be passed where the Babel
 * plugin hasn't turned the style updater into a worklet.
 */
const calls: { isWorklet: boolean; dependencies: unknown }[] = []

jest.mock("react-native-reanimated", () => {
    const reanimated = jest.requireActual("react-native-reanimated")
    return {
        ...reanimated,
        useAnimatedStyle: (updater: any, dependencies?: unknown[]) => {
            calls.push({ isWorklet: !!updater.__workletHash, dependencies })
            return reanimated.useAnimatedStyle(updater, dependencies)
        },
    }
})

test("doesn't pass dependencies when the style updater is a worklet", async () => {
    await render(<motion.View animate={{ opacity: 1 }} />)
    expect(calls.length).toBeGreaterThan(0)
    for (const { isWorklet, dependencies } of calls) {
        expect(isWorklet).toBe(true)
        expect(dependencies).toBeUndefined()
    }
})
