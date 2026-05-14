import { KeyframeResolver } from "../KeyframesResolver"

describe("KeyframeResolver", () => {
    test("uses the resolved final keyframe when start keyframe is a wildcard", () => {
        const readValue = jest.fn(() => undefined)

        const resolver = new KeyframeResolver<number>(
            [null as any, null as any],
            (resolvedKeyframes) => {
                expect(resolvedKeyframes).toEqual([300, 300])
            },
            "x",
            undefined,
            { readValue } as any
        )

        resolver.finalKeyframe = 300
        resolver.scheduleResolve()

        expect(readValue).toHaveBeenCalledWith("x", 300)
    })
})
