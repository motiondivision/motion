/**
 * @jest-environment node
 */
import { animateTarget } from "../visual-element-target"

describe("animateTarget in a non-browser environment", () => {
    const createValue = () => ({
        get: () => 0,
        set: () => {},
        isAnimating: () => false,
        start: () => {},
        stop: () => {},
        getVelocity: () => 0,
        claim: () => {},
        finishAnimation: () => {},
        animation: undefined,
    })

    const createVisualElement = () => {
        const values: Record<string, any> = {}
        return {
            getDefaultTransition: () => undefined,
            animationState: undefined,
            latestValues: {},
            shouldReduceMotion: false,
            /**
             * Values are set rather than animated, as there's no DOM to
             * animate.
             */
            shouldSkipAnimations: true,
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
