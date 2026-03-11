import { type WithDepth, FlatTree } from "motion-dom"

describe("FlatTree", () => {
    test("Correctly sorts by depth on iteration", () => {
        const tree = new FlatTree()

        tree.add({ depth: 1 })
        tree.add({ depth: 0 })
        expect((tree as any).children).toStrictEqual([
            { depth: 1 },
            { depth: 0 },
        ])

        const received: WithDepth[] = []
        tree.forEach((child) => received.push(child))
        expect(received).toStrictEqual([{ depth: 0 }, { depth: 1 }])
        expect((tree as any).children).toStrictEqual([
            { depth: 0 },
            { depth: 1 },
        ])
    })

    test("Doesn't crash when removing child mid-loop", () => {
        const tree = new FlatTree()
        const toRemove = { depth: 1 }
        tree.add({ depth: 0 })
        tree.add(toRemove)

        const received: WithDepth[] = []
        tree.forEach((child) => {
            received.push(child)
            tree.remove(toRemove)
        })
        expect(received).toStrictEqual([{ depth: 0 }])
    })
})
