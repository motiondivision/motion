import { Box } from "motion-utils"
import { createDelta, createBox } from "../../geometry/models"
import type { Measurements } from "../types"
import { createTestNode } from "./TestProjectionNode"
import { nextFrame } from "./utils"

type AnimationStub = Animation & {
    cancel: jest.Mock
    commitStyles: jest.Mock
    finish: jest.Mock
}

const createBoxWith = (minX: number, maxX: number, minY: number, maxY: number) => {
    const box = createBox()
    box.x.min = minX
    box.x.max = maxX
    box.y.min = minY
    box.y.max = maxY
    return box
}

const createMeasurements = (box: Box, source: number): Measurements => ({
    animationId: 0,
    measuredBox: box,
    layoutBox: box,
    latestValues: {},
    source,
})

const createAnimationStub = (): AnimationStub => ({
    playState: "running",
    currentTime: 0,
    playbackRate: 1,
    cancel: jest.fn(),
    commitStyles: jest.fn(),
    finish: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    effect: {
        getComputedTiming: () => ({ duration: 1000 }),
    },
} as unknown as AnimationStub)

const setupAnimateMock = () => {
    const animation = createAnimationStub()
    const animate = jest.fn().mockReturnValue(animation)
    const originalAnimate = HTMLElement.prototype.animate
    HTMLElement.prototype.animate = animate as any

    return {
        animation,
        animate,
        restore: () => {
            HTMLElement.prototype.animate = originalAnimate
        },
    }
}

describe("native layout animations", () => {
    test("leaf node uses WAAPI for layout transforms", async () => {
        const { animate, restore } = setupAnimateMock()

        try {
            const node = createTestNode(undefined, { layout: true })
            const element = document.createElement("div")
            node.mount(element as any)

            node.layoutCorrected = createBox()
            node.layout = createMeasurements(
                createBoxWith(0, 100, 0, 100),
                1
            )
            node.snapshot = createMeasurements(
                createBoxWith(100, 200, 100, 200),
                0
            )

            const delta = createDelta()
            delta.x.translate = 100
            delta.y.translate = 100

            node.startAnimation({ duration: 0.2 } as any)
            node.setAnimationOrigin(delta)

            await nextFrame()

            expect(animate).toHaveBeenCalled()
            expect(animate.mock.calls[0][0]).toHaveProperty("transform")
        } finally {
            restore()
        }
    })

    test("nodes with projecting children do not use WAAPI", async () => {
        const { animate, restore } = setupAnimateMock()

        try {
            const parent = createTestNode(undefined, { layout: true })
            const child = createTestNode(parent, { layout: true })

            const parentElement = document.createElement("div")
            parent.mount(parentElement as any)

            child.mount(document.createElement("div") as any)
            child.layout = createMeasurements(
                createBoxWith(0, 50, 0, 50),
                2
            )
            child.layoutCorrected = createBox()
            const childDelta = createDelta()
            childDelta.x.translate = 10
            childDelta.y.translate = 10
            child.setTargetDelta(childDelta)

            parent.layoutCorrected = createBox()
            parent.layout = createMeasurements(
                createBoxWith(0, 100, 0, 100),
                1
            )
            parent.snapshot = createMeasurements(
                createBoxWith(50, 150, 50, 150),
                0
            )

            const delta = createDelta()
            delta.x.translate = 50
            delta.y.translate = 50

            parent.startAnimation({ duration: 0.2 } as any)
            parent.setAnimationOrigin(delta)

            await nextFrame()

            expect(animate).not.toHaveBeenCalled()
        } finally {
            restore()
        }
    })

    test("native layout animations are stopped before measurement", async () => {
        const { animate, animation, restore } = setupAnimateMock()

        try {
            const node = createTestNode(undefined, { layout: true })
            const element = document.createElement("div")
            node.mount(element as any)

            node.layoutCorrected = createBox()
            node.layout = createMeasurements(
                createBoxWith(0, 100, 0, 100),
                1
            )
            node.snapshot = createMeasurements(
                createBoxWith(100, 200, 100, 200),
                0
            )

            const delta = createDelta()
            delta.x.translate = 100
            delta.y.translate = 100

            node.startAnimation({ duration: 0.2 } as any)
            node.setAnimationOrigin(delta)

            await nextFrame()

            expect(animate).toHaveBeenCalled()

            node.willUpdate()

            expect(animation.cancel).toHaveBeenCalled()
        } finally {
            restore()
        }
    })
})
