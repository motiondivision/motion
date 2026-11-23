import { act, useState } from "react"
import { stepFrames } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion"

/**
 * Removing a transformed ancestor's transform from its children's
 * measurements reads the ancestor's box. Nothing moves it between its
 * children's measurements in one pass, so it's read once per pass rather
 * than once per child.
 */
const reads: Record<string, number> = {}

function box(top: number, left: number, width: number, height: number) {
    return {
        x: left,
        y: top,
        top,
        left,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON() {},
    } as DOMRect
}

let toggle: VoidFunction

function App({ count }: { count: number }) {
    const [isOpen, setOpen] = useState(false)
    toggle = () => setOpen((value) => !value)
    const children = []
    for (let i = 0; i < count; i++) {
        children.push(
            <motion.div
                key={i}
                id={"child" + i}
                layout
                data-open={isOpen}
                transition={{ duration: 0.05 }}
            />
        )
    }
    return (
        <motion.div id="parent" style={{ x: "10%", y: 20 }}>
            {children}
        </motion.div>
    )
}

describe("transformed ancestors", () => {
    beforeEach(() => {
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            reads[this.id] = (reads[this.id] || 0) + 1
            if (this.id === "parent") return box(0, 0, 400, 400)
            const index = Number(this.id.slice(5))
            const open = this.dataset.open === "true"
            // Boxes include #parent's transform, as the browser's do
            return box(index * 30 + (open ? 100 : 0) + 20, 40, 100, 25)
        })
    })

    afterEach(() => jest.restoreAllMocks())

    test("is read once per measuring pass, however many children it has", async () => {
        render(<App count={10} />)
        await stepFrames(50)
        for (const id in reads) delete reads[id]

        await act(async () => toggle())
        await stepFrames(50)

        // One read before the update and one after
        expect(reads.parent).toBeLessThanOrEqual(2)
        expect(reads.child0).toBeGreaterThanOrEqual(2)
    })
})
