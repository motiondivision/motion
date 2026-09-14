import { makeNoneKeyframesAnimatable } from "../make-none-animatable"

describe("makeNoneKeyframesAnimatable", () => {
    test("derives a zero equivalent from an animatable keyframe", () => {
        const keyframes = ["none", "10px 20px"]
        makeNoneKeyframesAnimatable(keyframes, [0], "boxShadow")
        expect(keyframes).toEqual(["0px 0px", "10px 20px"])
    })

    test("uses the first animatable keyframe as the template", () => {
        const keyframes = ["#fff", "none"]
        makeNoneKeyframesAnimatable(keyframes, [1], "backgroundColor")
        expect(keyframes).toEqual(["#fff", "rgba(255, 255, 255, 0)"])
    })

    test("a zero-valued unit string is its own template", () => {
        const keyframes = ["0%", "50%"]
        makeNoneKeyframesAnimatable(keyframes, [0], "width")
        expect(keyframes).toEqual(["0%", "50%"])
    })

    test("numeric strings can be templates", () => {
        const keyframes = ["none", "50"]
        makeNoneKeyframesAnimatable(keyframes, [0], "width")
        expect(keyframes).toEqual(["0", "50"])
    })

    test("ignores invalid templates and numbers", () => {
        const keyframes: Array<string | number> = [0, "auto", 100]
        makeNoneKeyframesAnimatable(keyframes, [0], "width")
        expect(keyframes).toEqual([0, "auto", 100])
    })
})
