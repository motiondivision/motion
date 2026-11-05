import { frame } from "../../frameloop"
import { animateLayout } from "../animate-layout"
import {
    createLayoutPlane,
    LayoutPlane,
    LayoutPlaneSource,
} from "../layout-plane"
import { layoutPlanes } from "../layout-planes"
import { rootProjectionNode } from "../../projection/node/root"

function nextFrame() {
    return new Promise<void>((resolve) => frame.postRender(() => resolve()))
}

interface Render {
    corners?: number[]
    opacity: number
    visible: boolean
}

/**
 * The corners a unit-square homography maps onto.
 */
function cornersOf(t: Float64Array) {
    const out: number[] = []
    for (const [x, y] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
    ]) {
        const w = t[6] * x + t[7] * y + t[8]
        out.push(
            (t[0] * x + t[1] * y + t[2]) / w,
            (t[3] * x + t[4] * y + t[5]) / w
        )
    }
    return out
}

/**
 * A plane drawn at `quad`, which records how Motion draws it.
 */
function createSource(quad: number[]) {
    const renders: Render[] = []
    const source: LayoutPlaneSource = {
        measure: (out) => (out.set(quad), true),
        track: (out) => (out.set(quad), true),
        render: (transform, opacity, visible) => {
            renders.push({
                corners: transform && cornersOf(transform),
                opacity,
                visible,
            })
        },
    }
    const last = () => renders[renders.length - 1]
    return { source, renders, last }
}

function createCard(left: number, top: number, width: number, height: number) {
    const card = document.createElement("div")
    card.setAttribute("data-layout-id", "card")
    card.getBoundingClientRect = () =>
        ({
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height,
            x: left,
            y: top,
        } as DOMRect)
    return card
}

const cardCorners = [40, 60, 200, 60, 200, 160, 40, 160]

/**
 * A plane turned away from the viewer, so its corners aren't a rectangle.
 */
const planeCorners = [420, 210, 610, 240, 600, 330, 430, 350]

function expectCorners(actual: number[] | undefined, expected: number[]) {
    expect(actual).toBeDefined()
    for (let i = 0; i < 8; i++) {
        expect(actual![i]).toBeCloseTo(expected[i], 3)
    }
}

function centre(q: number[]) {
    const d = (q[0] - q[4]) * (q[3] - q[7]) - (q[1] - q[5]) * (q[2] - q[6])
    const a = q[0] * q[5] - q[1] * q[4]
    const b = q[2] * q[7] - q[3] * q[6]
    return [
        (a * (q[2] - q[6]) - (q[0] - q[4]) * b) / d,
        (a * (q[3] - q[7]) - (q[1] - q[5]) * b) / d,
    ]
}

async function seek(controls: { time: number }, time: number) {
    controls.time = time
    await nextFrame()
}

describe("createLayoutPlane", () => {
    const planes: LayoutPlane[] = []
    const plane = (source: LayoutPlaneSource, visible = true) => {
        const created = createLayoutPlane(source, { layoutId: "card", visible })
        planes.push(created)
        return created
    }

    afterEach(async () => {
        planes.forEach((created) => created.hide())
        planes.length = 0
        await animateLayout(() => (document.body.innerHTML = ""))
        await nextFrame()
    })

    test("draws a plane where it's laid out, and hides it", async () => {
        const { source, last } = createSource(planeCorners)

        const created = plane(source, false)
        expect(last()).toEqual({
            corners: undefined,
            opacity: 0,
            visible: false,
        })

        created.show()
        await nextFrame()
        expect(last()).toEqual({
            corners: undefined,
            opacity: 1,
            visible: true,
        })
        expect(layoutPlanes.size).toBe(1)

        created.hide()
        expect(last().visible).toBe(false)
        expect(layoutPlanes.size).toBe(0)
        expect(rootProjectionNode.current!.isUpdating).toBe(false)
    })

    test("doesn't animate from an element it replaced outside an update", async () => {
        const card = createCard(40, 60, 160, 100)
        document.body.appendChild(card)
        await animateLayout(() => {})

        const quad = [...planeCorners]
        const { source, last } = createSource(quad)
        plane(source)
        await nextFrame()

        const moved = [100, 300, 260, 280, 250, 400, 110, 390]
        const controls = await animateLayout(
            () => {
                quad.splice(0, 8, ...moved)
            },
            { duration: 10, ease: "linear" }
        )
        controls.pause()

        await seek(controls, 0)
        expectCorners(last().corners, planeCorners)
    })

    test("hands over from an element to a plane", async () => {
        const card = createCard(40, 60, 160, 100)
        document.body.appendChild(card)

        const { source, last } = createSource(planeCorners)
        const created = plane(source, false)

        const controls = await animateLayout(
            () => {
                card.remove()
                created.show()
            },
            { duration: 10, ease: "linear" }
        )
        controls.pause()

        await seek(controls, 0)
        expect(last().visible).toBe(true)
        expect(last().opacity).toBe(1)
        expectCorners(last().corners, cardCorners)

        await seek(controls, 5)
        const [cx, cy] = centre(last().corners!)
        const [fromX, fromY] = centre(cardCorners)
        const [toX, toY] = centre(planeCorners)
        expect(cx).toBeCloseTo((fromX + toX) / 2, 3)
        expect(cy).toBeCloseTo((fromY + toY) / 2, 3)

        await seek(controls, 10)
        expectCorners(last().corners, planeCorners)

        controls.complete()
        await nextFrame()
        await nextFrame()
        expect(last()).toEqual({
            corners: undefined,
            opacity: 1,
            visible: true,
        })
    })

    test("hands over from a plane to an element", async () => {
        const { source, last } = createSource(planeCorners)
        const created = plane(source)
        await nextFrame()

        const card = createCard(40, 60, 160, 100)

        const controls = await animateLayout(
            () => {
                document.body.appendChild(card)
                created.hide()
            },
            { duration: 10, ease: "linear" }
        )
        controls.pause()

        /**
         * The plane follows the element, which starts over it, and fades
         * out once the element has faded in.
         */
        await seek(controls, 0)
        expect(card.style.transform).toContain("matrix3d")
        expect(last().visible).toBe(true)
        expectCorners(last().corners, planeCorners)

        await seek(controls, 7.5)
        expect(last().opacity).toBeCloseTo(1 - 0.25 / 0.45, 3)

        await seek(controls, 10)
        expectCorners(last().corners, cardCorners)

        controls.complete()
        await nextFrame()
        await nextFrame()
        expect(last().visible).toBe(false)
        expect(layoutPlanes.size).toBe(0)
    })

    test("animates a plane laid out somewhere else", async () => {
        const quad = [...planeCorners]
        const { source, last } = createSource(quad)
        plane(source)
        await nextFrame()

        const moved = [100, 300, 260, 280, 250, 400, 110, 390]

        const controls = await animateLayout(
            () => {
                quad.splice(0, 8, ...moved)
            },
            { duration: 10, ease: "linear" }
        )
        controls.pause()

        await seek(controls, 0)
        expectCorners(last().corners, planeCorners)

        await seek(controls, 10)
        expectCorners(last().corners, moved)
    })

    test("lands wherever the plane has moved to while it animates", async () => {
        const card = createCard(40, 60, 160, 100)
        document.body.appendChild(card)

        const quad = [...planeCorners]
        const { source, last } = createSource(quad)
        const created = plane(source, false)

        const controls = await animateLayout(
            () => {
                card.remove()
                created.show()
            },
            { duration: 10, ease: "linear" }
        )
        controls.pause()

        await seek(controls, 5)

        const moved = [300, 100, 520, 140, 500, 260, 320, 240]
        quad.splice(0, 8, ...moved)

        await seek(controls, 10)
        expectCorners(last().corners, moved)
    })
})
