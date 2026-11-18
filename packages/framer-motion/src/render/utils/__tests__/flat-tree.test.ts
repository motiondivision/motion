import { type WithDepth, FlatTree } from "motion-dom"

function collect(tree: FlatTree) {
    const received: WithDepth[] = []
    tree.forEach((child) => received.push(child))
    return received
}

describe("FlatTree", () => {
    test("Correctly sorts by depth on iteration", () => {
        const tree = new FlatTree()
        const a = { depth: 1 }
        const b = { depth: 0 }
        const c = { depth: 2 }

        tree.add(a)
        tree.add(b)
        expect(collect(tree)).toEqual([b, a])

        tree.add(c)
        expect(collect(tree)).toEqual([b, a, c])
    })

    test("Only adds a child once", () => {
        const tree = new FlatTree()
        const child = { depth: 0 }

        tree.add(child)
        tree.add(child)
        expect(collect(tree)).toEqual([child])
    })

    test("Doesn't visit a removed child", () => {
        const tree = new FlatTree()
        const a = { depth: 0 }
        const b = { depth: 1 }

        tree.add(a)
        tree.add(b)
        tree.remove(a)
        tree.remove(a)
        expect(collect(tree)).toEqual([b])
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

    test("Visits the children after one that removes itself mid-loop", () => {
        const tree = new FlatTree()
        const children = [{ depth: 0 }, { depth: 1 }, { depth: 2 }]
        children.forEach((child) => tree.add(child))

        const received: WithDepth[] = []
        tree.forEach((child) => {
            received.push(child)
            child === children[0] && tree.remove(child)
        })
        expect(received).toEqual(children)
        expect(collect(tree)).toEqual([children[1], children[2]])
    })

    test("Doesn't visit a child added mid-loop until the next loop", () => {
        const tree = new FlatTree()
        const a = { depth: 1 }
        const b = { depth: 0 }
        tree.add(a)

        const received: WithDepth[] = []
        tree.forEach((child) => {
            received.push(child)
            tree.add(b)
        })
        expect(received).toEqual([a])
        expect(collect(tree)).toEqual([b, a])
    })
})
