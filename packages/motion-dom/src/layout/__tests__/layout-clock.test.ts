import { MotionGlobalConfig } from "motion-utils"
import { animateLayout } from "../.."
import { frameData } from "../../frameloop"
import { processFrame } from "../../frameloop/process-frame"

/**
 * Layout animations that start in the same frame share one clock, unless
 * their nodes were given different transitions, like those of two
 * animateLayout() calls, whose controls must stay their own.
 */
function setRect(element: Element, left: number, width: number) {
    element.getBoundingClientRect = () =>
        ({
            left,
            top: 0,
            width,
            height: 100,
            right: left + width,
            bottom: 100,
            x: left,
            y: 0,
        } as DOMRect)
}

function makeScope() {
    const scope = document.createElement("div")
    const element = document.createElement("div")
    element.setAttribute("data-layout", "")
    scope.appendChild(element)
    document.body.appendChild(scope)
    setRect(element, 0, 100)
    return { scope, element }
}

const step = (ms: number) => processFrame(frameData.timestamp + ms)

describe("layout animation clocks", () => {
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
    })
    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
        document.body.innerHTML = ""
    })

    test("two animateLayout() calls in one frame keep their own controls", async () => {
        const a = makeScope()
        const b = makeScope()

        const builderA = animateLayout(
            a.scope,
            () => setRect(a.element, 100, 100),
            { duration: 1, ease: "linear" }
        )
        const builderB = animateLayout(
            b.scope,
            () => setRect(b.element, 100, 100),
            { duration: 1, ease: "linear" }
        )
        const [animationA, animationB] = await Promise.all([builderA, builderB])

        step(16)
        step(250)
        animationA.pause()
        const pausedAt = a.element.style.transform
        step(250)

        expect(a.element.style.transform).toBe(pausedAt)
        expect(b.element.style.transform).not.toBe(pausedAt)
        expect(b.element.style.transform).toContain("translate")

        animationA.stop()
        animationB.stop()
    })

    test("the elements of one animateLayout() share one clock", async () => {
        const { scope, element } = makeScope()
        const other = document.createElement("div")
        other.setAttribute("data-layout", "")
        scope.appendChild(other)
        setRect(other, 0, 50)

        const animation: any = await animateLayout(
            scope,
            () => {
                setRect(element, 100, 100)
                setRect(other, 200, 50)
            },
            { duration: 1 }
        )

        /**
         * The group holds the shared animation, which has a track for each.
         */
        expect(animation.animations).toHaveLength(1)
        const [a, b] = animation.animations[0].tracks
        expect(a.parent).toBe(b.parent)

        /**
         * Stopping one leaves the other running.
         */
        a.stop()
        step(16)
        step(100)
        expect(a.state).toBe("idle")
        expect(b.state).toBe("running")
        step(1000)
        expect(b.state).toBe("finished")
    })
})
