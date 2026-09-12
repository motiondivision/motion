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

function createSVGMockOptions(overrides: Record<string, any> = {}) {
    const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
    )
    return createMockOptions({
        motionValue: {
            owner: {
                current: element,
                getProps: () => ({}),
            },
        },
        ...overrides,
    })
}

describe("supportsBrowserAnimation", () => {
    it.each([
        "width",
        "height",
        "borderRadius",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
    ])("uses native animation for %s outside layout", (name) => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({ name, keyframes: [10, 40] })
            )
        ).toBe(true)
    })

    it.each([
        { layout: true },
        { layout: "position" },
        { layout: "size" },
        { layoutId: "shared" },
        { layoutId: "" },
    ])("keeps new properties on JS for layout props %o", (props) => {
        for (const name of [
            "width",
            "height",
            "borderRadius",
            "borderTopLeftRadius",
        ]) {
            const options = createMockOptions({ name, keyframes: [10, 40] })
            options.motionValue.owner.getProps = () => props
            expect(supportsBrowserAnimation(options)).toBe(false)
        }
    })

    it("checks vanilla layout projection options without React props", () => {
        const options = createMockOptions({
            name: "borderRadius",
            keyframes: [10, 40],
        })
        options.motionValue.owner.projection = { options: { layout: true } }
        expect(supportsBrowserAnimation(options)).toBe(false)
        options.motionValue.owner.projection.options = { layoutId: "shared" }
        expect(supportsBrowserAnimation(options)).toBe(false)
    })

    it.each(["data-layout", "data-layout-id"])(
        "keeps tagged vanilla elements on JS before their first layout animation: %s",
        (attribute) => {
            const options = createMockOptions({
                name: "borderRadius",
                keyframes: [10, 40],
            })
            options.motionValue.owner.current.setAttribute(attribute, "")
            expect(supportsBrowserAnimation(options)).toBe(false)
        }
    )

    it("does not exclude ordinary motion components with an inactive projection node", () => {
        const options = createMockOptions({
            name: "borderRadius",
            keyframes: [10, 40],
        })
        options.motionValue.owner.projection = { options: {} }
        options.motionValue.owner.getProps = () => ({ layout: false })
        expect(supportsBrowserAnimation(options)).toBe(true)
    })

    it.each(["color", "boxShadow", "--radius", "x", "display"])(
        "does not broaden eligibility for %s",
        (name) => {
            expect(supportsBrowserAnimation(createMockOptions({ name }))).toBe(
                false
            )
        }
    )

    it("does not enable SVG dimensions through the HTML property list", () => {
        expect(
            supportsBrowserAnimation(
                createSVGMockOptions({ name: "width", keyframes: [10, 40] })
            )
        ).toBe(false)
    })

    it.each([
        { repeatDelay: 1 },
        { repeatType: "mirror" },
        { damping: 0 },
        { type: "inertia" },
    ])(
        "preserves transition restrictions for new properties: %o",
        (overrides) => {
            expect(
                supportsBrowserAnimation(
                    createMockOptions({
                        name: "width",
                        keyframes: [10, 40],
                        ...overrides,
                    })
                )
            ).toBe(false)
        }
    )

    it("preserves onUpdate for new properties", () => {
        const options = createMockOptions({
            name: "width",
            keyframes: [10, 40],
        })
        options.motionValue.owner.getProps = () => ({ onUpdate: () => {} })
        expect(supportsBrowserAnimation(options)).toBe(false)
    })

    it.each([
        [10, 40],
        ["10px", "40px"],
        ["10%", "40%"],
    ])("accepts compatible numeric keyframes %o → %o", (from, to) => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "borderRadius",
                    keyframes: [from, to],
                })
            )
        ).toBe(true)
    })

    it.each([
        [10, "40px"],
        ["10px", "40%"],
        [-10, 40],
        [NaN, 40],
        [Infinity, 40],
        ["-10%", "40%"],
        ["10px 20px", "20px 40px"],
        ["calc(10% + 2px)", "calc(20% + 4px)"],
        ["auto", "40px"],
        ["var(--from)", "var(--to)"],
    ])(
        "keeps unresolved or incompatible keyframes %o → %o on JS",
        (from, to) => {
            expect(
                supportsBrowserAnimation(
                    createMockOptions({
                        name: "borderRadius",
                        keyframes: [from, to],
                    })
                )
            ).toBe(false)
        }
    )

    it("returns true for accelerated values like opacity", () => {
        expect(supportsBrowserAnimation(createMockOptions())).toBe(true)
    })

    it("returns true for opacity on SVG elements", () => {
        expect(supportsBrowserAnimation(createSVGMockOptions())).toBe(true)
    })

    it("returns true for transform on SVG elements", () => {
        expect(
            supportsBrowserAnimation(
                createSVGMockOptions({
                    name: "transform",
                    keyframes: ["translateX(0px)", "translateX(100px)"],
                })
            )
        ).toBe(true)
    })

    it("returns false when the subject is not an element", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    motionValue: {
                        owner: {
                            current: {},
                            getProps: () => ({}),
                        },
                    },
                })
            )
        ).toBe(false)
    })

    it("returns true for backgroundColor with standard hex keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "backgroundColor",
                    keyframes: ["#ffffff", "#000000"],
                })
            )
        ).toBe(true)
    })

    it("returns false for color with standard rgba keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "color",
                    keyframes: ["rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"],
                })
            )
        ).toBe(false)
    })

    it("returns false for backgroundColor when onUpdate is set", () => {
        const element = document.createElement("div")
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "backgroundColor",
                    keyframes: ["#ffffff", "#000000"],
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

    it("returns false for a color not in the accelerated set with standard keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "borderTopColor",
                    keyframes: ["#ffffff", "#000000"],
                })
            )
        ).toBe(false)
    })

    it("returns true for a color not in the accelerated set with oklch keyframes", () => {
        expect(
            supportsBrowserAnimation(
                createMockOptions({
                    name: "borderTopColor",
                    keyframes: ["#ffffff", "oklch(0.65 0.18 260)"],
                })
            )
        ).toBe(true)
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
                    keyframes: ["#fff", "color-mix(in srgb, red 50%, blue)"],
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
