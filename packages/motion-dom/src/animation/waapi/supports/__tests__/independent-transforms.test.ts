import { supportsFlags } from "../../../../utils/supports/flags"
import { supportsBrowserAnimation } from "../waapi"

beforeAll(() => {
    Object.defineProperty(Element.prototype, "animate", {
        value: () => {},
        writable: true,
        configurable: true,
    })
    supportsFlags.independentTransforms = true
})

afterAll(() => {
    supportsFlags.independentTransforms = undefined
})

function createOptions(
    name: string,
    owner: Record<string, any> = {},
    overrides: Record<string, any> = {}
) {
    const element = document.createElement("div")
    return {
        motionValue: {
            owner: {
                current: element,
                getProps: () => ({}),
                latestValues: {},
                renderState: {
                    style: {},
                    transform: {},
                    transformOrigin: {},
                    vars: {},
                },
                ...owner,
            },
        },
        keyframes: [0, 100],
        name,
        repeatDelay: 0,
        repeatType: "loop",
        damping: 10,
        type: "keyframes",
        ...overrides,
    } as any
}

describe("supportsBrowserAnimation - independent transforms", () => {
    it("accelerates x, y, scale and rotate on HTML elements", () => {
        for (const name of ["x", "y", "z", "scale", "scaleX", "rotate"]) {
            expect(supportsBrowserAnimation(createOptions(name))).toBe(true)
        }
    })

    it("does not accelerate in browsers without the individual transform properties", () => {
        supportsFlags.independentTransforms = false
        expect(supportsBrowserAnimation(createOptions("x"))).toBe(false)
        supportsFlags.independentTransforms = true
        expect(supportsBrowserAnimation(createOptions("x"))).toBe(true)
    })

    it("does not accelerate transforms that have no individual CSS property", () => {
        for (const name of [
            "skewX",
            "transformPerspective",
            "rotateX",
            "translateX",
        ]) {
            expect(supportsBrowserAnimation(createOptions(name))).toBe(false)
        }
    })

    it("does not accelerate when the element has a transformTemplate", () => {
        expect(
            supportsBrowserAnimation(
                createOptions("x", {
                    getProps: () => ({ transformTemplate: () => "" }),
                })
            )
        ).toBe(false)
    })

    it("does not accelerate when the element animates layout", () => {
        expect(
            supportsBrowserAnimation(
                createOptions("x", {
                    projection: { options: { layout: true } },
                })
            )
        ).toBe(false)
        expect(
            supportsBrowserAnimation(
                createOptions("x", {
                    projection: { options: { layoutId: "a" } },
                })
            )
        ).toBe(false)
        expect(
            supportsBrowserAnimation(
                createOptions("x", {
                    projection: { options: {} },
                })
            )
        ).toBe(true)
    })

    it("does not accelerate when sibling transforms can't be expressed as individual properties", () => {
        expect(
            supportsBrowserAnimation(
                createOptions("x", { latestValues: { skewX: 10 } })
            )
        ).toBe(false)
        expect(
            supportsBrowserAnimation(
                createOptions("x", {
                    latestValues: { transformPerspective: 500 },
                })
            )
        ).toBe(false)
        expect(
            supportsBrowserAnimation(
                createOptions("x", { latestValues: { transform: "none" } })
            )
        ).toBe(false)
        // Non-uniform scale and rotation compose in a different order
        expect(
            supportsBrowserAnimation(
                createOptions("rotate", { latestValues: { scaleX: 2 } })
            )
        ).toBe(false)
        expect(
            supportsBrowserAnimation(
                createOptions("scaleX", { latestValues: { scale: 2 } })
            )
        ).toBe(false)
        // Uniform scale and rotation commute
        expect(
            supportsBrowserAnimation(
                createOptions("rotate", { latestValues: { scale: 2, x: 10 } })
            )
        ).toBe(true)
    })

    it("does not accelerate transforms on SVG elements", () => {
        expect(
            supportsBrowserAnimation(
                createOptions("x", {
                    current: document.createElementNS(
                        "http://www.w3.org/2000/svg",
                        "circle"
                    ),
                })
            )
        ).toBe(false)
    })

    it("still respects the generic WAAPI checks", () => {
        expect(
            supportsBrowserAnimation(
                createOptions("x", {}, { type: "inertia" })
            )
        ).toBe(false)
        expect(
            supportsBrowserAnimation(
                createOptions("x", {}, { repeatType: "mirror" })
            )
        ).toBe(false)
        expect(
            supportsBrowserAnimation(
                createOptions("x", { getProps: () => ({ onUpdate: () => {} }) })
            )
        ).toBe(false)
    })
})
