import { fireEvent } from "@testing-library/dom"
import {
    createDelta,
    getFeatureDefinitions,
    HTMLProjectionNode,
    motionValue,
    visualElementStore,
} from "motion-dom"
import { act, useRef } from "react"
import {
    domDrag,
    domMax,
    LazyMotion,
    m,
    useDragControls,
} from "../../.."
import { pointerUp, render } from "../../../jest.setup"
import { nextFrame } from "../../../gestures/__tests__/utils"
import {
    drag,
    dragFrame,
    MockDrag,
    sleep,
} from "../../../gestures/drag/__tests__/utils"
import { FeatureBundle } from "../../../motion/features/types"

const makeRect = (left: number, top: number, width: number, height: number) =>
    ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
    } as DOMRect)

describe("domDrag feature bundle", () => {
    afterEach(() => {
        pointerUp(document.body)
        jest.restoreAllMocks()
    })

    test("uses lightweight measurement node without loading layout projection", async () => {
        const { container } = render(
            <LazyMotion features={domDrag}>
                <m.div id="draggable" drag />
                <m.div id="animated" animate={{ x: 10 }} />
            </LazyMotion>
        )
        await nextFrame()

        const definitions = getFeatureDefinitions()
        expect(definitions.drag?.Feature).toBeDefined()
        expect(definitions.pan?.Feature).toBeDefined()
        expect(definitions.layout?.ProjectionNode).toBeUndefined()
        expect(definitions.layout?.MeasureLayout).toBeUndefined()

        const dragVE = visualElementStore.get(
            container.querySelector("#draggable")!
        )!
        const animVE = visualElementStore.get(
            container.querySelector("#animated")!
        )!

        expect(dragVE.projection).toBeDefined()
        expect(dragVE.projection.isMeasureOnly).toBe(true)
        expect(dragVE.projection).not.toBeInstanceOf(HTMLProjectionNode)
        expect(animVE.projection).toBeUndefined()
    })

    test("handles drag start, move, and end", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const onDragStart = jest.fn()
        const onDrag = jest.fn()
        const onDragEnd = jest.fn()

        const { getByTestId } = render(
            <LazyMotion features={domDrag}>
                <MockDrag>
                    <m.div
                        data-testid="box"
                        drag
                        dragMomentum={false}
                        style={{ x, y }}
                        onDragStart={onDragStart}
                        onDrag={onDrag}
                        onDragEnd={onDragEnd}
                    />
                </MockDrag>
            </LazyMotion>
        )
        await nextFrame()

        const element = getByTestId("box")
        const pointer = await drag(element).to(10, 5)
        await pointer.to(60, 40)
        pointer.end()
        await nextFrame()

        expect(onDragStart).toHaveBeenCalledTimes(1)
        expect(onDrag).toHaveBeenCalled()
        expect(onDragEnd).toHaveBeenCalledTimes(1)
        expect(x.get()).toBe(60)
        expect(y.get()).toBe(40)
    })

    test("applies relative object constraints and dragElastic", async () => {
        const x = motionValue(0)

        const { getByTestId } = render(
            <LazyMotion features={domDrag}>
                <MockDrag>
                    <m.div
                        data-testid="box"
                        drag="x"
                        dragConstraints={{ left: -50, right: 50 }}
                        dragElastic={0.5}
                        dragMomentum={false}
                        style={{ x }}
                    />
                </MockDrag>
            </LazyMotion>
        )
        await nextFrame()

        const element = getByTestId("box")
        const pointer = await drag(element).to(1, 0)
        await pointer.to(150, 0)

        // 50 within constraints + 0.5 * 100 past right edge = 100
        expect(x.get()).toBe(100)
        pointer.end()
    })

    test("applies ref dragConstraints, onMeasureDragConstraints, and resizes", async () => {
        const x = motionValue(0)
        const onMeasure = jest.fn()
        let containerWidth = 400

        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            if (this.dataset.testid === "container") {
                return makeRect(0, 0, containerWidth, 200)
            }
            if (this.dataset.testid === "box") {
                return makeRect(0, 0, 100, 100)
            }
            return makeRect(0, 0, 0, 0)
        })

        const pointer = (type: string, target: Element, pageX: number) => {
            const event = new PointerEvent(type, {
                isPrimary: true,
                bubbles: true,
            })
            Object.assign(event, { clientX: pageX, clientY: 0, pageX, pageY: 0 })
            act(() => {
                fireEvent(target, event)
            })
        }

        const Component = () => {
            const containerRef = useRef<HTMLDivElement>(null)
            return (
                <LazyMotion features={domDrag}>
                    <div ref={containerRef} data-testid="container">
                        <m.div
                            data-testid="box"
                            drag="x"
                            dragConstraints={containerRef}
                            dragElastic={0}
                            dragMomentum={false}
                            onMeasureDragConstraints={onMeasure}
                            style={{ x }}
                        />
                    </div>
                </LazyMotion>
            )
        }

        const { getByTestId } = render(<Component />)
        await nextFrame()

        expect(onMeasure).toHaveBeenCalledWith({
            left: 0,
            right: 300,
            top: 0,
            bottom: 100,
        })

        const element = getByTestId("box")
        pointer("pointerdown", element, 0)
        for (const pageX of [1, 500]) {
            pointer("pointermove", document.body, pageX)
            await act(async () => {
                await dragFrame.postRender()
            })
        }
        pointer("pointerup", document.body, 500)
        await nextFrame()

        expect(x.get()).toBe(300)

        // Resize container and verify element repositions proportionally
        containerWidth = 200
        act(() => {
            window.dispatchEvent(new Event("resize"))
        })
        await nextFrame()

        expect(x.get()).toBe(100)
    })

    test("measures ref dragConstraints again after a re-render moves the element", async () => {
        const y = motionValue(0)
        let boxTop = 0

        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            if (this.dataset.testid === "container") {
                return makeRect(0, 0, 100, 400)
            }
            if (this.dataset.testid === "box") {
                return makeRect(0, boxTop, 100, 100)
            }
            return makeRect(0, 0, 0, 0)
        })

        const pointer = (type: string, target: Element, pageY: number) => {
            const event = new PointerEvent(type, {
                isPrimary: true,
                bubbles: true,
            })
            Object.assign(event, { clientX: 0, clientY: pageY, pageX: 0, pageY })
            act(() => {
                fireEvent(target, event)
            })
        }
        const move = async (pageY: number) => {
            pointer("pointermove", document.body, pageY)
            await act(async () => {
                await dragFrame.postRender()
            })
        }

        const Component = ({ offset }: { offset: number }) => {
            const containerRef = useRef<HTMLDivElement>(null)
            return (
                <LazyMotion features={domDrag}>
                    <div ref={containerRef} data-testid="container">
                        <div style={{ height: offset }} />
                        <m.div
                            data-testid="box"
                            drag="y"
                            dragConstraints={containerRef}
                            dragElastic={0}
                            dragMomentum={false}
                            style={{ y }}
                        />
                    </div>
                </LazyMotion>
            )
        }

        const { getByTestId, rerender } = render(<Component offset={0} />)
        await nextFrame()

        // Content above the box grows, moving it 100px down its container
        boxTop = 100
        rerender(<Component offset={100} />)
        await nextFrame()

        pointer("pointerdown", getByTestId("box"), 0)
        await move(1)
        await move(1000)
        expect(y.get()).toBe(200)
        await move(-1000)
        expect(y.get()).toBe(-100)
        pointer("pointerup", document.body, -1000)
    })

    test("supports dragMomentum inertia on release", async () => {
        const x = motionValue(0)

        const { getByTestId } = render(
            <LazyMotion features={domDrag}>
                <MockDrag>
                    <m.div
                        data-testid="box"
                        drag="x"
                        dragMomentum
                        style={{ x }}
                    />
                </MockDrag>
            </LazyMotion>
        )
        await nextFrame()

        const element = getByTestId("box")
        const pointer = await drag(element).to(10, 0)
        await pointer.to(100, 0)
        pointer.end()

        await sleep(50)

        expect(x.get()).toBeGreaterThan(100)
    })

    test("supports dragSnapToOrigin", async () => {
        const x = motionValue(0)

        const { getByTestId } = render(
            <LazyMotion features={domDrag}>
                <MockDrag>
                    <m.div
                        data-testid="box"
                        drag="x"
                        dragSnapToOrigin
                        dragTransition={{
                            bounceStiffness: 300000,
                            bounceDamping: 1000000,
                        }}
                        style={{ x }}
                    />
                </MockDrag>
            </LazyMotion>
        )
        await nextFrame()

        const element = getByTestId("box")
        const pointer = await drag(element).to(10, 0)
        await pointer.to(100, 0)
        expect(x.get()).toBe(100)

        pointer.end()
        await sleep(80)

        expect(x.get()).toBeCloseTo(0, 0)
    })

    test("supports useDragControls with dragListener={false}", async () => {
        const onDragStart = jest.fn()

        const Component = () => {
            const controls = useDragControls()
            return (
                <LazyMotion features={domDrag}>
                    <MockDrag>
                        <div
                            data-testid="handle"
                            onPointerDown={(e) => controls.start(e)}
                        />
                        <m.div
                            data-testid="box"
                            drag
                            dragControls={controls}
                            dragListener={false}
                            onDragStart={onDragStart}
                        />
                    </MockDrag>
                </LazyMotion>
            )
        }

        const { getByTestId } = render(<Component />)
        await nextFrame()

        // Direct drag on box should not start because dragListener={false}
        let pointer = await drag(getByTestId("box")).to(50, 50)
        pointer.end()
        await nextFrame()
        expect(onDragStart).toHaveBeenCalledTimes(0)

        // Starting via handle + dragControls should start dragging
        pointer = await drag(
            getByTestId("box"),
            getByTestId("handle")
        ).to(50, 50)
        pointer.end()
        await nextFrame()
        expect(onDragStart).toHaveBeenCalledTimes(1)
    })

    test("unmounts and remounts measurement node cleanly", async () => {
        const { container, unmount } = render(
            <LazyMotion features={domDrag}>
                <m.div id="box" drag />
            </LazyMotion>
        )
        await nextFrame()

        const element = container.querySelector("#box")! as HTMLElement
        const visualElement = visualElementStore.get(element)!
        expect(visualElement.projection?.isMeasureOnly).toBe(true)
        expect(visualElement.projection?.instance).toBe(element)

        unmount()
        expect(visualElement.projection?.instance).toBeUndefined()

        // Simulate StrictMode / Activity remount without re-render
        expect(() => visualElement.mount(element)).not.toThrow()
        expect(visualElement.projection?.instance).toBe(element)
    })

    /**
     * Runs last because loading domMax registers layout globally on
     * featureDefinitions.
     */
    test("seamlessly upgrades to HTMLProjectionNode when domMax loads later", async () => {
        const x = motionValue(0)
        const Component = ({ features }: { features: FeatureBundle }) => (
            <LazyMotion features={features}>
                <MockDrag>
                    <m.div id="box" drag="x" layout style={{ x }} />
                </MockDrag>
            </LazyMotion>
        )

        const { container, rerender } = render(
            <Component features={domDrag} />
        )
        await nextFrame()

        const element = container.querySelector("#box")!
        const visualElement = visualElementStore.get(element)!
        expect(visualElement.projection.isMeasureOnly).toBe(true)

        rerender(<Component features={domMax} />)
        await nextFrame()

        expect(visualElement.projection).toBeInstanceOf(HTMLProjectionNode)
        expect(visualElement.projection.instance).toBe(element)

        // Drag + layout didUpdate compensation should now work on the upgraded node
        const pointer = await drag(element).to(100, 0)
        expect(x.get()).toBe(100)

        const delta = createDelta()
        delta.x.translate = -40
        visualElement.projection.notifyListeners("didUpdate", {
            delta,
            hasLayoutChanged: true,
        })
        expect(x.get()).toBe(60)

        pointer.end()
    })
})
