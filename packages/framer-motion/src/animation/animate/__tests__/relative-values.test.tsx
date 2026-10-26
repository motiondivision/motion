import { frame, motionValue, visualElementStore } from "motion-dom"
import { animate } from ".."
import { motion, MotionGlobalConfig } from "../../.."
import { render } from "../../../jest.setup"

const duration = 0.001

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("animate: relative values", () => {
    test("adds to and subtracts from a motion value", async () => {
        const x = motionValue(100)
        await animate(x, "+=50", { duration })
        expect(x.get()).toBe(150)

        await animate(x, "-=75", { duration })
        expect(x.get()).toBe(75)
    })

    test("keeps the unit of a unit value", async () => {
        const width = motionValue("100px")
        await animate(width, "+=20", { duration })
        expect(width.get()).toBe("120px")

        await animate(width, "-=10.5px", { duration })
        expect(width.get()).toBe("109.5px")
    })

    test("takes the unit of the offset when the value is a number", async () => {
        const x = motionValue<number | string>(0)
        await animate(x, "+=50%", { duration })
        expect(x.get()).toBe("50%")
    })

    test("each keyframe is relative to the one before it", async () => {
        const x = motionValue(0)
        const values: number[] = []
        await animate(x, [null, "+=100", "-=25", 10, "+=5"], {
            duration,
            onUpdate: (v) => values.push(v),
        })
        expect(x.get()).toBe(15)
        expect(Math.max(...values)).toBeLessThanOrEqual(100)
    })

    test("animates an object's property", async () => {
        const obj = { x: 100 }
        await animate(obj, { x: "+=50" }, { duration })
        expect(obj.x).toBe(150)
    })

    test("animates an element's transform", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)

        await animate(element, { x: 100 }, { duration })
        await animate(element, { x: "+=50" }, { duration })
        await nextFrame()
        expect(element.style.transform).toBe("translateX(150px)")
        element.remove()
    })

    test("animates a style", async () => {
        const element = document.createElement("div")
        element.style.opacity = "0.2"
        document.body.appendChild(element)

        await animate(element, { opacity: "+=0.3" }, { duration })
        await nextFrame()
        expect(parseFloat(element.style.opacity)).toBeCloseTo(0.5)
        element.remove()
    })

    test("animates a <motion.div>'s value", async () => {
        const { container } = render(<motion.div initial={{ x: 50 }} />)
        const element = container.firstChild as HTMLElement

        await animate(element, { x: "+=50" }, { duration })
        await nextFrame()
        expect(visualElementStore.get(element)!.getValue("x")!.get()).toBe(
            100
        )
    })

    test("is relative to the previous segment in a sequence", async () => {
        const x = motionValue(100)
        await animate([
            [x, "+=50", { duration }],
            [x, "-=25", { duration }],
        ])
        expect(x.get()).toBe(125)
    })

    test("is relative to the previous segment of an element in a sequence", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)

        await animate([
            [element, { x: 100 }, { duration }],
            [element, { x: "+=50" }, { duration }],
        ])
        await nextFrame()
        expect(element.style.transform).toBe("translateX(150px)")
        element.remove()
    })

    test("resolves the target when animations are skipped", async () => {
        const x = motionValue(100)
        MotionGlobalConfig.instantAnimations = true
        try {
            await animate(x, "+=50", { duration: 1 })
            await nextFrame()
        } finally {
            MotionGlobalConfig.instantAnimations = false
        }
        expect(x.get()).toBe(150)
    })

    test("resolves the target when the transition is instant", async () => {
        const x = motionValue(100)
        await animate(x, "+=50", { type: false })
        await nextFrame()
        expect(x.get()).toBe(150)
    })

    test("stays relative to where it started when a timeline is rebuilt", async () => {
        const x = motionValue(0)
        const animation = animate(x, "+=100", { duration: 1, ease: "linear" })

        animation.pause()
        animation.time = 0.5
        await nextFrame()
        expect(x.get()).toBe(50)

        animation.call(() => {}, 0.75)
        animation.time = 0.25
        await nextFrame()
        expect(x.get()).toBe(25)

        animation.time = 1
        await nextFrame()
        expect(x.get()).toBe(100)
    })

    test("animates a <motion.div>'s animate prop once", async () => {
        const x = motionValue(50)
        const Component = () => (
            <motion.div
                style={{ x }}
                animate={{ x: "+=100" }}
                transition={{ duration }}
            />
        )
        const { rerender } = render(<Component />)
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(x.get()).toBe(150)

        rerender(<Component />)
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(x.get()).toBe(150)
    })

    test("a relative first keyframe is relative to the current value", async () => {
        const x = motionValue(100)
        await animate(x, ["+=10", "+=20"], { duration })
        expect(x.get()).toBe(130)
    })

    test("a relative first keyframe in a later sequence segment", async () => {
        const x = motionValue(100)
        const y = motionValue(0)
        await animate([
            [y, 1, { duration }],
            [x, ["+=10", "+=20"], { duration }],
        ])
        expect(x.get()).toBe(130)
    })

    test("a number origin never gives the result a unit", async () => {
        const x = motionValue(1e-7)
        await animate(x, "+=1", { duration })
        expect(x.get()).toBeCloseTo(1)
    })

    test("initial={false} doesn't render a relative target", async () => {
        const { container } = render(
            <motion.div initial={false} animate={{ x: "+=100", opacity: 0.5 }} />
        )
        const element = container.firstChild as HTMLElement
        await nextFrame()
        expect(element.style.transform).not.toContain("=")
        expect(element.style.opacity).toBe("0.5")
    })

    test("Types: number values only take unitless relative offsets", () => {
        const x = motionValue(0)
        animate(x, "+=10", { duration })
        // @ts-expect-error a unit would turn the number into a string
        animate(x, "+=10px", { duration })
    })
})
