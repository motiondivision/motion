import { useLayoutEffect, useRef, useState } from "react"
import { Reorder } from ".."
import { render, fireEvent, screen } from "../../../jest.setup"

describe("Reorder", () => {
    // Existing test ...
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
})

describe('Reorder.Group with axis="xy"', () => {
    const TestComponent = ({ initialItems, onReorderMock }: { initialItems: number[], onReorderMock: jest.Mock }) => {
        const [items, setItems] = useState(initialItems)

        // Mock getBoundingClientRect for all Reorder.Item elements
        // This is crucial because JSDOM doesn't provide real layout
        useLayoutEffect(() => {
            const mockGetBoundingClientRect = (el: HTMLElement) => {
                // Basic grid layout: 2 items per row, each 50x50px
                // This needs to be smarter if item order changes or for more complex layouts
                const id = parseInt(el.dataset.testid?.split("-")[1] || "0", 10)
                const x = (id % 2) * 50
                const y = Math.floor(id / 2) * 50
                return {
                    x, y, top: y, left: x,
                    width: 50, height: 50,
                    bottom: y + 50, right: x + 50,
                    toJSON: () => JSON.stringify(this)
                } as DOMRect
            }

            const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
            HTMLElement.prototype.getBoundingClientRect = function() {
                // Check if the element is one of our Reorder.Items by a conventional data-testid
                if (this.dataset.testid && this.dataset.testid.startsWith("item-")) {
                    return mockGetBoundingClientRect(this as HTMLElement)
                }
                return originalGetBoundingClientRect.call(this)
            }

            return () => {
                HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
            }
        }, [items])


        return (
            <Reorder.Group
                axis="xy"
                values={items}
                onReorder={(newOrder) => {
                    onReorderMock(newOrder)
                    setItems(newOrder)
                }}
                style={{ display: "flex", flexWrap: "wrap", width: "100px" }} // 2 items per row
            >
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        data-testid={`item-${item}`}
                        style={{ width: "50px", height: "50px", userSelect: "none" }}
                    >
                        {`Item ${item}`}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        )
    }

    it("should reorder items in a 2x2 grid", () => {
        const onReorderMock = jest.fn()
        const initialItems = [0, 1, 2, 3] // 0 1
                                         // 2 3
        render(<TestComponent initialItems={initialItems} onReorderMock={onReorderMock} />)

        const item0 = screen.getByTestId("item-0")
        // const item3 = screen.getByTestId("item-3") // For coordinate reference if needed

        // Simulate dragging item 0 to where item 3 is
        // Item 0 is at (0,0), Item 3 is at (50,50) in a 2x2 50x50 grid
        // We need to drag item0's center over item3's center.
        // Item0 center starts at (25,25). Item3 center is at (75,75).
        // So, move by (50,50)
        fireEvent.pointerDown(item0, { clientX: 25, clientY: 25 })
        // Move pointer to the center of where item 3 is
        fireEvent.pointerMove(document, { clientX: 75, clientY: 75 })
        fireEvent.pointerUp(document)

        // Expected order: item 0 and item 3 swap places
        // This depends heavily on the checkReorder logic for "xy"
        // If it swaps with the item whose area is most overlapped, or whose center is closest
        // Based on moveItem behavior (item 0 dragged to item 3's position):
        expect(onReorderMock).toHaveBeenCalledTimes(1)
        expect(onReorderMock).toHaveBeenCalledWith([1, 2, 3, 0])
    })
})
