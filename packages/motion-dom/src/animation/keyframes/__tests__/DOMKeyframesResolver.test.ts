import { frame } from "../../../frameloop"
import { motionValue } from "../../../value"
import { DOMKeyframesResolver } from "../DOMKeyframesResolver"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const createElement = (origin: number) => {
    const current = document.createElement("div")
    return {
        current,
        getValue: () => undefined,
        readValue: () => origin,
        render: () => {},
        measureViewportBox: () => ({
            x: { min: 0, max: 0 },
            y: { min: 0, max: 0 },
        }),
    } as any
}

describe("DOMKeyframesResolver", () => {
    test("reads an unknown origin in the next frame's read", async () => {
        const onComplete = jest.fn()
        const resolver = new DOMKeyframesResolver(
            [null, 100],
            onComplete,
            "x",
            motionValue<number>(undefined as any),
            createElement(20)
        )
        resolver.scheduleResolve()

        expect(resolver.state).toBe("scheduled")
        expect(onComplete).not.toHaveBeenCalled()

        await nextFrame()

        expect(resolver.state).toBe("complete")
        expect(onComplete).toHaveBeenCalledWith([20, 100], undefined, false)
    })

    test("resolves straight away when the origin is known", () => {
        const onComplete = jest.fn()
        const resolver = new DOMKeyframesResolver(
            [null, 100],
            onComplete,
            "x",
            motionValue(50),
            createElement(20)
        )
        resolver.scheduleResolve()

        expect(resolver.state).toBe("complete")
        expect(onComplete).toHaveBeenCalledWith([50, 100], undefined, false)
    })
})
