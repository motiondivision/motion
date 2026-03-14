import { supportsBrowserAnimation } from "../waapi"

// Mock Element.prototype.animate for supportsWaapi()
beforeAll(() => {
    Object.defineProperty(Element.prototype, "animate", {
        value: () => {},
        writable: true,
        configurable: true,
    })
})

function createMockOptions(overrides: Record<string, any> = {}) {
    const element = document.createElement("div")
    return {
        motionValue: {
            owner: {
                current: element,
                getProps: () => ({}),
            },
        },
        keyframes: ["#ffffff", "#000000"],
        name: "opacity",
        repeatDelay: 0,
        repeatType: "loop",
        damping: 10,
        type: "keyframes",
        ...overrides,
    } as any
}

describe("supportsBrowserAnimation", () => {
    it("returns true for accelerated values like opacity", () => {
        expect(supportsBrowserAnimation(createMockOptions())).toBe(true)
    })

    it("returns false for non-accelerated values without browser-only colors", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "backgroundColor",
                    keyframes: ["#ffffff", "#000000"],
                })
            )
        ).toBe(false)
    })

    it("returns true for color properties with oklch keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "backgroundColor",
                    keyframes: ["#ffffff", "oklch(0.65 0.18 260)"],
                })
            )
        ).toBe(true)
    })

    it("returns true for color properties with oklab keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "backgroundColor",
                    keyframes: ["#ffffff", "oklab(0.5 0.1 -0.1)"],
                })
            )
        ).toBe(true)
    })

    it("returns true for color properties with lab keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "color",
                    keyframes: ["#000", "lab(50 20 -30)"],
                })
            )
        ).toBe(true)
    })

    it("returns true for color properties with lch keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "borderColor",
                    keyframes: ["#000", "lch(50 30 260)"],
                })
            )
        ).toBe(true)
    })

    it("returns true for color properties with color-mix() keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "backgroundColor",
                    keyframes: [
                        "#fff",
                        "color-mix(in srgb, red 50%, blue)",
                    ],
                })
            )
        ).toBe(true)
    })

    it("returns false for non-color properties with oklch keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "width",
                    keyframes: ["0px", "oklch(0.65 0.18 260)"],
                })
            )
        ).toBe(false)
    })

    it("returns false when onUpdate is set even with browser-only colors", () => {
        const element = document.createElement("div")
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "backgroundColor",
                    keyframes: ["#fff", "oklch(0.65 0.18 260)"],
                    motionValue: {
                        owner: {
                            current: element,
                            getProps: () => ({ onUpdate: () => {} }),
                        },
                    },
                })
            )
        ).toBe(false)
    })
})
