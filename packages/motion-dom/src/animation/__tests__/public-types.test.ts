import type {
    AnimationOptions,
    AnimationPlaybackControls,
    DOMKeyframesDefinition,
    DynamicAnimationOptions,
} from "../../"

describe("motion-dom public type exports", () => {
    it("exports DynamicAnimationOptions as a public type alias of AnimationOptions", () => {
        const options: DynamicAnimationOptions = { duration: 0.5 }
        const asAnimationOptions: AnimationOptions = options
        expect(asAnimationOptions.duration).toBe(0.5)
    })

    it("exports DOMKeyframesDefinition", () => {
        const keyframes: DOMKeyframesDefinition = { opacity: [0, 1] }
        expect(keyframes.opacity).toEqual([0, 1])
    })

    it("exports AnimationPlaybackControls", () => {
        const playback: AnimationPlaybackControls | null = null
        expect(playback).toBeNull()
    })
})
