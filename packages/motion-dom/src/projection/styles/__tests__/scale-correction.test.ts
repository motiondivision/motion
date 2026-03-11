import { correctBorderRadius, pixelsToPercent } from "../scale-border-radius"
import { correctBoxShadow } from "../scale-box-shadow"

interface TestNode {
    target?: { x: { min: number; max: number }; y: { min: number; max: number } }
    projectionDelta?: {
        x: { scale: number; translate: number; origin: number; originPoint: number }
        y: { scale: number; translate: number; origin: number; originPoint: number }
    }
    treeScale?: { x: number; y: number }
}

function createTestNode(): TestNode {
    return {}
}

describe("pixelsToPercent", () => {
    test("Correctly converts pixels to percent", () => {
        expect(pixelsToPercent(10, { min: 300, max: 500 })).toEqual(5)
    })

    test("return 0 when max === min", () => {
        expect(pixelsToPercent(10, { min: 300, max: 300 })).toEqual(0)
    })
})

describe("correctBorderRadius", () => {
    let node: TestNode
    beforeEach(() => {
        node = createTestNode()
    })

    test("Leave non-pixel values alone", () => {
        node.target = {
            x: { min: 0, max: 0 },
            y: { min: 0, max: 0 },
        }
        expect(correctBorderRadius.correct("20%", node)).toBe("20%")
    })

    test("Correctly scales number values by converting them to percentage of the viewport box", () => {
        node.target = {
            x: { min: 0, max: 100 },
            y: { min: 0, max: 200 },
        }
        expect(correctBorderRadius.correct(20, node)).toBe("20% 10%")
    })

    test("Correctly scales pixel values by converting them to percentage of the viewport box", () => {
        node.target = {
            x: { min: 0, max: 100 },
            y: { min: 0, max: 200 },
        }
        expect(correctBorderRadius.correct("50px", node)).toBe("50% 25%")
    })
})

describe("correctBoxShadow", () => {
    let node: TestNode
    beforeEach(() => {
        node = createTestNode()
        node.projectionDelta = {
            x: { scale: 0.5, translate: 0, origin: 0, originPoint: 0 },
            y: { scale: 0.5, translate: 0, origin: 0, originPoint: 0 },
        }
    })

    test("Correctly scales box shadow", () => {
        node.treeScale = {
            x: 1,
            y: 1,
        }
        expect(correctBoxShadow.correct("5px 10px 20px 40px #000", node)).toBe(
            "10px 20px 40px 80px rgba(0, 0, 0, 1)"
        )
    })

    test("Correctly scales box shadow when the tree is scaled", () => {
        node.treeScale = {
            x: 0.5,
            y: 0.5,
        }
        expect(correctBoxShadow.correct("10px 10px 10px 10px #000", node)).toBe(
            "40px 40px 40px 40px rgba(0, 0, 0, 1)"
        )
    })

    test("Correctly scale box shadow with CSS variables", () => {
        node.treeScale = {
            x: 1,
            y: 1,
        }
        expect(
            correctBoxShadow.correct(
                "10px 10px 10px 10px var(--token-c8953278-7b3-4177-a0fa-f3cda39afd50, rgba(0, 0, 0, 1))",
                node
            )
        ).toBe(
            "20px 20px 20px 20px var(--token-c8953278-7b3-4177-a0fa-f3cda39afd50, rgba(0, 0, 0, 1))"
        )

        // TODO: Only supports a single shadow
        expect(
            correctBoxShadow.correct(
                "10px 10px 10px 10px rgba(0, 0, 0, 1), 0px 0px 0px 4px var(--token-c8953278-7b3-4177-a0fa-f3cda39afd50, #333)",
                node
            )
        ).toBe(
            "10px 10px 10px 10px rgba(0, 0, 0, 1), 0px 0px 0px 4px var(--token-c8953278-7b3-4177-a0fa-f3cda39afd50, #333)"
        )
    })
})
