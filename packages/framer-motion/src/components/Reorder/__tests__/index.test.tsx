import { useContext, useLayoutEffect, useRef } from "react"
import { Reorder } from ".."
import { ReorderContext } from "../../../context/ReorderContext"
import { render } from "../../../jest.setup"

describe("Reorder", () => {
    it("Correctly hydrates ref", () => {
        let groupRefPass = false
        let itemRefPass = false

        const Component = () => {
            const groupRef = useRef<HTMLElement>(null)
            const itemRef = useRef<HTMLElement>(null)

            useLayoutEffect(() => {
                if (groupRef.current !== null) {
                    groupRefPass = true
                }

                if (itemRef.current !== null) {
                    itemRefPass = true
                }
            })

            return (
                <Reorder.Group
                    as="article"
                    ref={groupRef}
                    onReorder={() => {}}
                    values={[]}
                >
                    <Reorder.Item as="main" ref={itemRef} value={0} />
                </Reorder.Group>
            )
        }

        render(<Component />)
        expect(groupRefPass).toBe(true)
        expect(itemRefPass).toBe(true)
    })

    it("Preserves unmeasured items during reorder (virtualized list support)", () => {
        const onReorder = jest.fn()
        let capturedContext: any = null

        const ContextCapture = () => {
            const context = useContext(ReorderContext)
            capturedContext = context
            return null
        }

        const Component = () => (
            <Reorder.Group
                onReorder={onReorder}
                values={[1, 2, 3, 4, 5]}
                axis="y"
            >
                <ContextCapture />
            </Reorder.Group>
        )

        render(<Component />)

        // Register only a subset of items (simulating virtualization —
        // items 1 and 5 are offscreen and not rendered/measured)
        capturedContext.registerItem(2, {
            x: { min: 0, max: 100 },
            y: { min: 0, max: 50 },
        })
        capturedContext.registerItem(3, {
            x: { min: 0, max: 100 },
            y: { min: 50, max: 100 },
        })
        capturedContext.registerItem(4, {
            x: { min: 0, max: 100 },
            y: { min: 100, max: 150 },
        })

        // Drag item 2 past item 3: offset=30, velocity=1
        // Item 2 max=50, item 3 center=75, 50+30=80 > 75 triggers swap
        capturedContext.updateOrder(2, 30, 1)

        // Should swap 2 and 3 in the FULL values array, not just measured items
        expect(onReorder).toHaveBeenCalledWith([1, 3, 2, 4, 5])
    })
})
