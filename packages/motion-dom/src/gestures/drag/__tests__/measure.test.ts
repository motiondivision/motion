/**
 * drag() measures the element's layout to resolve constraints. Without
 * animateLayout() in the bundle it uses a measurement-only node, and with
 * it the shared layout projection tree, so run each test against both.
 */
type DragModule = typeof import("..")
type Utils = typeof import("./utils")

function load(withLayout: boolean): DragModule & Utils {
    let modules!: DragModule & Utils
    jest.isolateModules(() => {
        if (withLayout) require("../../../layout/LayoutAnimationBuilder")
        modules = { ...require(".."), ...require("./utils") }
    })
    return modules
}

function setRect(
    element: Element,
    left: number,
    top: number,
    width: number,
    height: number
) {
    element.getBoundingClientRect = () =>
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
}

function setScroll(x: number, y: number) {
    const { documentElement } = document
    Object.defineProperty(documentElement, "scrollLeft", {
        value: x,
        configurable: true,
    })
    Object.defineProperty(documentElement, "scrollTop", {
        value: y,
        configurable: true,
    })
}

describe.each([
    ["drag() alone", false],
    ["drag() with animateLayout()", true],
])("%s", (_, withLayout) => {
    const { drag, createElement, gesture, values, nextFrame } = load(withLayout)

    let stops: VoidFunction[] = []
    const makeDraggable = (...args: Parameters<typeof drag>) => {
        const stop = drag(...args)
        stops.push(stop)
        return stop
    }

    /**
     * The page is scrolled throughout, so element constraints are only
     * right if the element and container are measured with the same
     * page scroll.
     */
    beforeAll(() => setScroll(30, 300))

    afterAll(() => {
        delete (document.documentElement as any).scrollLeft
        delete (document.documentElement as any).scrollTop
    })

    afterEach(() => {
        stops.forEach((stop) => stop())
        stops = []
        document.body.innerHTML = ""
    })

    test("element constraints keep the element inside the container", async () => {
        const container = createElement()
        const element = createElement("div", container)
        setRect(container, 50, 50, 300, 300)
        setRect(element, 100, 100, 50, 50)

        makeDraggable(element, {
            constraints: container,
            elastic: 0,
            momentum: false,
        })
        await nextFrame()

        let pointer = await gesture(element).to(1, 1)
        await pointer.to(1000, -1000)
        pointer.end()
        await nextFrame()

        expect(values(element)).toEqual({ x: 200, y: -50 })

        pointer = await gesture(element).to(1, 1)
        await pointer.to(-1000, 1000)
        pointer.end()
        await nextFrame()

        expect(values(element)).toEqual({ x: -50, y: 200 })
    })

    test("elastic lets the element past element constraints during a drag", async () => {
        const container = createElement()
        const element = createElement("div", container)
        setRect(container, 0, 0, 200, 200)
        setRect(element, 0, 0, 100, 100)

        makeDraggable(element, {
            constraints: container,
            elastic: 0.5,
            momentum: false,
        })
        await nextFrame()

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(300, 0)

        // 100 inside the constraints, then half of the remaining 200
        expect(values(element).x).toBe(200)
        pointer.end()
    })

    test("object constraints are relative to the element's origin", async () => {
        const element = createElement()
        setRect(element, 200, 400, 50, 50)

        makeDraggable(element, {
            constraints: { left: -50, right: 50, top: -20, bottom: 20 },
            elastic: 0,
            momentum: false,
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(500, -500)
        pointer.end()
        await nextFrame()

        expect(values(element)).toEqual({ x: 50, y: -20 })
    })

    test("onMeasureConstraints receives the measured element constraints", async () => {
        const container = createElement()
        const element = createElement("div", container)
        setRect(container, 0, 0, 400, 300)
        setRect(element, 100, 50, 100, 100)

        const onMeasureConstraints = jest.fn()
        makeDraggable(element, { constraints: container, onMeasureConstraints })
        await nextFrame()

        expect(onMeasureConstraints).toHaveBeenLastCalledWith({
            left: -100,
            right: 200,
            top: -50,
            bottom: 150,
        })
    })

    test("repositions the element within its constraints on window resize", async () => {
        const container = createElement()
        const element = createElement("div", container)
        setRect(container, 0, 0, 500, 100)
        setRect(element, 0, 0, 100, 100)

        makeDraggable(element, {
            axis: "x",
            constraints: container,
            elastic: 0,
            momentum: false,
        })
        await nextFrame()

        const pointer = await gesture(element).to(1, 0)
        await pointer.to(1000, 0)
        pointer.end()
        await nextFrame()
        expect(values(element).x).toBe(400)

        setRect(container, 0, 0, 300, 100)
        window.dispatchEvent(new Event("resize"))
        await nextFrame()

        expect(values(element).x).toBe(200)
        expect(element.style.transform).toBe("translateX(200px)")
    })

    test("drag() after stop() measures the element again", async () => {
        const container = createElement()
        const element = createElement("div", container)
        setRect(container, 0, 0, 300, 300)
        setRect(element, 0, 0, 100, 100)

        drag(element, {
            constraints: container,
            elastic: 0,
            momentum: false,
        })()

        setRect(container, 0, 0, 200, 200)
        makeDraggable(element, {
            constraints: container,
            elastic: 0,
            momentum: false,
        })
        await nextFrame()

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(1000, 1000)
        pointer.end()
        await nextFrame()

        expect(values(element)).toEqual({ x: 100, y: 100 })
    })
})
