import { isTransitionDefined } from "../is-transition-defined"

describe("isTransitionDefined", () => {
    test("Detects a transition", () => {
        expect(isTransitionDefined({})).toBe(false)
        expect(isTransitionDefined({ when: "beforeChildren" })).toBe(false)
        expect(isTransitionDefined({ delay: 0 })).toBe(false)
        expect(isTransitionDefined({ elapsed: 0 })).toBe(false)
        expect(isTransitionDefined({ duration: 1 })).toBe(true)
        expect(isTransitionDefined({ delay: 0, duration: 1 })).toBe(true)
        expect(isTransitionDefined({ type: "tween" })).toBe(true)
        expect(isTransitionDefined({ ease: "linear" })).toBe(true)
    })

    test("Ignores out, so setting it keeps a value's default transition (#1725)", () => {
        expect(isTransitionDefined({ out: true })).toBe(false)
        expect(isTransitionDefined({ out: { duration: 1 } })).toBe(false)
        expect(isTransitionDefined({ delay: 1, out: true })).toBe(false)
        expect(isTransitionDefined({ duration: 1, out: true })).toBe(true)
    })
})
