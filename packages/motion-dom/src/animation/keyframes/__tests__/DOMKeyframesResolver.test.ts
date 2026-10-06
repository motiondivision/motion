import { motionValue } from "../../../value"
import { flushKeyframeResolvers } from "../KeyframesResolver"
import { DOMKeyframesResolver } from "../DOMKeyframesResolver"
import { WithRender } from "../types"

function createElement(): WithRender {
    const current = document.createElement("div")
    document.body.appendChild(current)
    return {
        current,
        render: () => {},
        readValue: (name) => getComputedStyle(current).getPropertyValue(name),
        getValue: () => undefined,
        measureViewportBox: () => ({
            x: { min: 0, max: 100 },
            y: { min: 0, max: 100 },
        }),
    }
}

function resolve(
    keyframes: any[],
    name: string,
    value = motionValue<any>(undefined)
) {
    const onComplete = jest.fn()
    new DOMKeyframesResolver(
        keyframes,
        onComplete,
        name,
        value,
        createElement()
    ).scheduleResolve()
    return onComplete
}

describe("DOMKeyframesResolver", () => {
    afterEach(() => flushKeyframeResolvers())

    test("Resolves explicit keyframes immediately", () => {
        const onComplete = resolve([0, 100], "x")
        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(onComplete.mock.calls[0][0]).toEqual([0, 100])
    })

    test("Resolves explicit keyframes with matching units immediately", () => {
        const onComplete = resolve(["0%", "50%"], "width")
        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(onComplete.mock.calls[0][0]).toEqual(["0%", "50%"])
    })

    test("Resolves from the current motion value immediately", () => {
        const onComplete = resolve([null, 100], "x", motionValue(20))
        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(onComplete.mock.calls[0][0]).toEqual([20, 100])
    })

    test("Defers keyframes that need reading from the DOM", () => {
        const onComplete = resolve([null, 100], "x")
        expect(onComplete).not.toHaveBeenCalled()
        flushKeyframeResolvers()
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("Defers keyframes that contain CSS variables", () => {
        const onComplete = resolve(["var(--a)", 100], "opacity")
        expect(onComplete).not.toHaveBeenCalled()
        flushKeyframeResolvers()
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("Defers keyframes that need a unit conversion measurement", () => {
        const onComplete = resolve(["10px", "50%"], "width")
        expect(onComplete).not.toHaveBeenCalled()
        flushKeyframeResolvers()
        expect(onComplete).toHaveBeenCalledTimes(1)
    })
})
