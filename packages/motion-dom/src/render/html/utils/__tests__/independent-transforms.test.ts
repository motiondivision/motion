import { HTMLRenderState } from "../../types"
import { buildHTMLStyles } from "../build-styles"

function createState(): HTMLRenderState {
    return { style: {}, transform: {}, transformOrigin: {}, vars: {} }
}

describe("buildHTMLStyles - independent transforms", () => {
    it("builds transform shorthand by default", () => {
        const state = createState()
        buildHTMLStyles(state, { x: 10, scale: 2, rotate: 45 })
        expect(state.style.transform).toBe(
            "translateX(10px) scale(2) rotate(45deg)"
        )
        expect(state.style.translate).toBeUndefined()
    })

    it("writes translate, scale and rotate when accelerated", () => {
        const state = createState()
        state.independentTransforms = true
        buildHTMLStyles(state, { x: 10, y: "20%", scale: 2, rotate: 45 })
        expect(state.style.transform).toBe("none")
        expect(state.style.translate).toBe("10px 20%")
        expect(state.style.scale).toBe("2")
        expect(state.style.rotate).toBe("45deg")
    })

    it("writes defaults as none", () => {
        const state = createState()
        state.independentTransforms = true
        buildHTMLStyles(state, { x: 0, y: 0, scale: 1, rotate: 0 })
        expect(state.style.translate).toBe("none")
        expect(state.style.scale).toBe("none")
        expect(state.style.rotate).toBe("none")
    })

    it("includes z and axis scales", () => {
        const state = createState()
        state.independentTransforms = true
        buildHTMLStyles(state, { x: 0, z: 5, scaleX: 2, scaleY: 0.5 })
        expect(state.style.translate).toBe("0px 0px 5px")
        expect(state.style.scale).toBe("2 0.5")
        expect(state.style.rotate).toBe("none")

        buildHTMLStyles(state, { rotateZ: 10 })
        expect(state.style.rotate).toBe("10deg")
    })

    it("falls back to the transform shorthand when a value can't be expressed", () => {
        const state = createState()
        state.independentTransforms = true
        buildHTMLStyles(state, { x: 10 })
        expect(state.style.translate).toBe("10px 0px")

        buildHTMLStyles(state, { x: 10, skewX: 5 })
        expect(state.independentTransforms).toBe(false)
        expect(state.style.transform).toBe("translateX(10px) skewX(5deg)")
        expect(state.style.translate).toBe("none")
        expect(state.style.scale).toBe("none")
        expect(state.style.rotate).toBe("none")
    })
})
