/**
 * @jest-environment node
 */
import { animateTarget } from "../visual-element-target"

/**
 * Regression test for #3735.
 *
 * In non-browser JS runtimes (or when `window` is shadowed by an IIFE wrapper,
 * e.g. Lynx's web runtime), bare `window` accesses see `undefined`. `animateTarget`
 * read `window.MotionHandoffAnimation` without a `typeof window` guard, throwing
 * `TypeError: Cannot read properties of undefined (reading 'MotionHandoffAnimation')`.
 *
 * This file runs in the `node` test environment so `window` is genuinely undefined,
 * matching the reported runtime.
 */
describe("animateTarget in a non-browser environment", () => {
    const createValue = () => ({
        get: () => 0,
        set: () => {},
        isAnimating: () => false,
        start: () => {},
        stop: () => {},
        animation: undefined,
    })

    const createVisualElement = () => {
        const values: Record<string, any> = {}
        return {
            getDefaultTransition: () => undefined,
            animationState: undefined,
            latestValues: {},
            shouldReduceMotion: false,
            props: {},
            getValue: (key: string) => {
                if (key === "willChange") return undefined
                return (values[key] ||= createValue())
            },
            addValue: () => {},
        } as any
    }

    it("does not throw when window is undefined", () => {
        expect(typeof window).toBe("undefined")
        expect(() =>
            animateTarget(createVisualElement(), { opacity: 1 })
        ).not.toThrow()
    })
})
