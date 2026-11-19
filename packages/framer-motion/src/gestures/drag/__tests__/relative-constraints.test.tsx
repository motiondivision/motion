import { act, fireEvent } from "@testing-library/react"
import { useRef } from "react"
import { BoundingBox, motion, motionValue } from "../../../"
import { render } from "../../../jest.setup"
import { nextFrame } from "../../__tests__/utils"
import { dragFrame, sleep } from "./utils"

/**
 * Mimic a 100x100 element laid out at (200, 0) and offset by its
 * transform, inside a 1000x1000 container, as JSDOM doesn't perform
 * layout.
 */
function mockLayout(x: { get(): number }) {
    const rect = (left: number, size: number) =>
        ({
            left,
            top: 0,
            right: left + size,
            bottom: size,
            width: size,
            height: size,
        } as DOMRect)

    return jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
            return this.dataset.testid === "draggable"
                ? rect(200 + x.get(), 100)
                : rect(0, 1000)
        })
}

function pointer(type: string, target: Element, pageX: number) {
    const event = new PointerEvent(type, { isPrimary: true, bubbles: true })
    Object.assign(event, { clientX: pageX, clientY: 0, pageX, pageY: 0 })
    act(() => {
        fireEvent(target, event)
    })
}

async function dragBy(element: Element, distance: number) {
    pointer("pointerdown", element, 0)
    for (const pageX of [Math.sign(distance), distance]) {
        pointer("pointermove", document.body, pageX)
        await act(async () => {
            await dragFrame.postRender()
        })
    }
    pointer("pointerup", document.body, distance)
    await nextFrame()
}

describe("relative dragConstraints", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    test("are relative to where the element is laid out", async () => {
        const x = motionValue(0)
        mockLayout(x)

        const { getByTestId } = render(
            <motion.div
                data-testid="draggable"
                drag="x"
                dragConstraints={{ left: -50, right: 50 }}
                dragElastic={false}
                dragMomentum={false}
                style={{ x }}
            />
        )
        const element = getByTestId("draggable")

        await dragBy(element, 20)
        expect(x.get()).toBe(20)

        await dragBy(element, 100)
        expect(x.get()).toBe(50)

        await dragBy(element, -200)
        expect(x.get()).toBe(-50)
    })

    test("stay relative after onMeasureDragConstraints has returned constraints", async () => {
        const x = motionValue(0)
        mockLayout(x)
        const onMeasure = jest.fn((constraints: BoundingBox) => constraints)

        const Component = ({ relative }: { relative?: boolean }) => {
            const ref = useRef<HTMLDivElement>(null)
            return (
                <div ref={ref}>
                    <motion.div
                        data-testid="draggable"
                        drag="x"
                        dragConstraints={
                            relative ? { left: -50, right: 50 } : ref
                        }
                        dragElastic={false}
                        dragMomentum={false}
                        onMeasureDragConstraints={onMeasure}
                        style={{ x }}
                    />
                </div>
            )
        }

        const { getByTestId, rerender } = render(<Component />)
        const element = getByTestId("draggable")

        /**
         * The container allows 200px to the left and 700px to the right.
         */
        await dragBy(element, 20)
        expect(onMeasure).toHaveBeenCalled()
        expect(x.get()).toBe(20)

        rerender(<Component relative />)

        await dragBy(element, 10)
        expect(x.get()).toBe(30)

        await dragBy(element, 100)
        expect(x.get()).toBe(50)
    })

    test("leave an edge they don't set to dragTransition", async () => {
        const x = motionValue(0)
        mockLayout(x)

        const { getByTestId } = render(
            <motion.div
                data-testid="draggable"
                drag="x"
                dragConstraints={{ right: 100 }}
                dragElastic={false}
                dragMomentum={false}
                dragTransition={{
                    min: -20,
                    bounceStiffness: 300000,
                    bounceDamping: 1000000,
                }}
                style={{ x }}
            />
        )

        await dragBy(getByTestId("draggable"), -50)
        await sleep(50)

        // A spring this stiff has brought it back to `min` by now
        expect(x.get()).toBeCloseTo(-20)
    })
})
