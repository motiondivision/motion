import { createAutoScroll } from "../auto-scroll"

describe("auto-scroll", () => {
    function createMockScrollElement(rect: Partial<DOMRect>) {
        const defaultRect: DOMRect = {
            top: 0,
            left: 0,
            bottom: 500,
            right: 500,
            width: 500,
            height: 500,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }
        return {
            scrollTop: 0,
            scrollLeft: 0,
            getBoundingClientRect: () => ({ ...defaultRect, ...rect }),
        } as HTMLElement
    }

    describe("vertical scrolling (y axis)", () => {
        it("should scroll up when near the top edge", () => {
            const autoScroll = createAutoScroll("y")
            const element = createMockScrollElement({ top: 0, bottom: 500 })

            // Pointer at 20px from top (within default threshold of 50)
            autoScroll.updateScroll(20, element)

            expect(element.scrollTop).toBeLessThan(0)
        })

        it("should scroll down when near the bottom edge", () => {
            const autoScroll = createAutoScroll("y")
            const element = createMockScrollElement({ top: 0, bottom: 500 })

            // Pointer at 480px (20px from bottom, within default threshold of 50)
            autoScroll.updateScroll(480, element)

            expect(element.scrollTop).toBeGreaterThan(0)
        })

        it("should not scroll when in the middle", () => {
            const autoScroll = createAutoScroll("y")
            const element = createMockScrollElement({ top: 0, bottom: 500 })

            // Pointer at 250px (middle of container)
            autoScroll.updateScroll(250, element)

            expect(element.scrollTop).toBe(0)
        })

        it("should scroll faster when closer to edge", () => {
            const autoScroll = createAutoScroll("y")
            const element1 = createMockScrollElement({ top: 0, bottom: 500 })
            const element2 = createMockScrollElement({ top: 0, bottom: 500 })

            // Pointer at 10px from bottom
            autoScroll.updateScroll(490, element1)
            const scroll1 = element1.scrollTop

            // Pointer at 40px from bottom
            autoScroll.updateScroll(460, element2)
            const scroll2 = element2.scrollTop

            expect(Math.abs(scroll1)).toBeGreaterThan(Math.abs(scroll2))
        })
    })

    describe("horizontal scrolling (x axis)", () => {
        it("should scroll left when near the left edge", () => {
            const autoScroll = createAutoScroll("x")
            const element = createMockScrollElement({ left: 0, right: 500 })

            // Pointer at 20px from left (within default threshold of 50)
            autoScroll.updateScroll(20, element)

            expect(element.scrollLeft).toBeLessThan(0)
        })

        it("should scroll right when near the right edge", () => {
            const autoScroll = createAutoScroll("x")
            const element = createMockScrollElement({ left: 0, right: 500 })

            // Pointer at 480px (20px from right, within default threshold of 50)
            autoScroll.updateScroll(480, element)

            expect(element.scrollLeft).toBeGreaterThan(0)
        })

        it("should not scroll when in the middle", () => {
            const autoScroll = createAutoScroll("x")
            const element = createMockScrollElement({ left: 0, right: 500 })

            // Pointer at 250px (middle of container)
            autoScroll.updateScroll(250, element)

            expect(element.scrollLeft).toBe(0)
        })
    })

    describe("custom options", () => {
        it("should respect custom threshold", () => {
            const autoScroll = createAutoScroll("y", { threshold: 100 })
            const element = createMockScrollElement({ top: 0, bottom: 500 })

            // Pointer at 80px from top (within custom threshold of 100)
            autoScroll.updateScroll(80, element)

            expect(element.scrollTop).toBeLessThan(0)
        })

        it("should respect custom maxSpeed", () => {
            const slowScroll = createAutoScroll("y", { maxSpeed: 10 })
            const fastScroll = createAutoScroll("y", { maxSpeed: 50 })

            const slowElement = createMockScrollElement({ top: 0, bottom: 500 })
            const fastElement = createMockScrollElement({ top: 0, bottom: 500 })

            // Both at same position near edge
            slowScroll.updateScroll(10, slowElement)
            fastScroll.updateScroll(10, fastElement)

            expect(Math.abs(fastElement.scrollTop)).toBeGreaterThan(
                Math.abs(slowElement.scrollTop)
            )
        })
    })

    describe("edge cases", () => {
        it("should handle null scroll element", () => {
            const autoScroll = createAutoScroll("y")

            // Should not throw
            expect(() => autoScroll.updateScroll(100, null)).not.toThrow()
        })

        it("should handle pointer exactly at threshold boundary", () => {
            const autoScroll = createAutoScroll("y", { threshold: 50 })
            const element = createMockScrollElement({ top: 0, bottom: 500 })

            // Pointer exactly at threshold (50px from top)
            autoScroll.updateScroll(50, element)

            // Should not scroll when at exact boundary
            expect(element.scrollTop).toBe(0)
        })
    })
})
