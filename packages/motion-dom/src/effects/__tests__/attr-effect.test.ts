import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { attrEffect } from "../attr"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("attrEffect", () => {
    it("sets attributes after attrEffect is applied", async () => {
        const element = document.createElement("div")

        // Create motion values
        const width = motionValue("100")
        const height = motionValue("200")
        const dataTest = motionValue("test-value")

        // Apply attr effect
        attrEffect(element, {
            width,
            height,
            "data-test": dataTest,
            dataCamelToKebab: dataTest,
            "aria-test": dataTest,
            ariaCamelToKebab: dataTest,
        })

        await nextFrame()

        // Verify attributes are set
        expect(element.getAttribute("width")).toBe("100")
        expect(element.getAttribute("height")).toBe("200")
        expect(element.getAttribute("data-test")).toBe("test-value")
        expect(element.getAttribute("data-camel-to-kebab")).toBe("test-value")
        expect(element.getAttribute("aria-test")).toBe("test-value")
        expect(element.getAttribute("aria-camel-to-kebab")).toBe("test-value")
    })

    it("updates attributes when motion values change", async () => {
        const element = document.createElement("div")

        // Create motion values
        const width = motionValue("100")
        const dataTest = motionValue("test-value")

        // Apply attr effect
        attrEffect(element, {
            width,
            "data-test": dataTest,
        })

        await nextFrame()

        // Verify initial attributes
        expect(element.getAttribute("width")).toBe("100")
        expect(element.getAttribute("data-test")).toBe("test-value")

        // Change motion values
        width.set("200")
        dataTest.set("new-value")

        // Updates should be scheduled for the next frame render
        // Attributes should not have changed yet
        expect(element.getAttribute("width")).toBe("100")
        expect(element.getAttribute("data-test")).toBe("test-value")

        await nextFrame()

        // Verify attributes are updated
        expect(element.getAttribute("width")).toBe("200")
        expect(element.getAttribute("data-test")).toBe("new-value")
    })

    it("removes attributes when value is null or undefined", async () => {
        const element = document.createElement("div")

        // Create motion values
        const width = motionValue<string | null>("100")
        const dataTest = motionValue<string | null>("test-value")

        // Apply attr effect
        attrEffect(element, {
            width,
            "data-test": dataTest,
        })

        await nextFrame()

        // Verify initial attributes
        expect(element.getAttribute("width")).toBe("100")
        expect(element.getAttribute("data-test")).toBe("test-value")

        // Set values to null/undefined
        width.set(null)
        dataTest.set(null)

        await nextFrame()

        // Verify attributes are removed
        expect(element.hasAttribute("width")).toBe(false)
        expect(element.hasAttribute("data-test")).toBe(false)
    })

    it("handles multiple elements", async () => {
        // Create additional elements
        const element = document.createElement("div")
        const element2 = document.createElement("div")

        const width = motionValue("100")
        const dataTest = motionValue("test-value")

        attrEffect([element, element2], {
            width,
            "data-test": dataTest,
        })

        await nextFrame()

        expect(element.getAttribute("width")).toBe("100")
        expect(element.getAttribute("data-test")).toBe("test-value")
        expect(element2.getAttribute("width")).toBe("100")
        expect(element2.getAttribute("data-test")).toBe("test-value")

        width.set("200")
        dataTest.set("new-value")

        await nextFrame()

        expect(element.getAttribute("width")).toBe("200")
        expect(element.getAttribute("data-test")).toBe("new-value")
        expect(element2.getAttribute("width")).toBe("200")
        expect(element2.getAttribute("data-test")).toBe("new-value")
    })

    it("returns cleanup function that stops updating attributes", async () => {
        const element = document.createElement("div")
        // Create motion values
        const width = motionValue("100")
        const dataTest = motionValue("test-value")

        // Apply attr effect and get cleanup function
        const cleanup = attrEffect(element, {
            width,
            "data-test": dataTest,
        })

        await nextFrame()

        // Verify initial attributes
        expect(element.getAttribute("width")).toBe("100")
        expect(element.getAttribute("data-test")).toBe("test-value")

        // Change values and verify update on next frame
        width.set("200")
        dataTest.set("new-value")

        await nextFrame()

        // Verify update happened
        expect(element.getAttribute("width")).toBe("200")
        expect(element.getAttribute("data-test")).toBe("new-value")

        // Call cleanup function
        cleanup()

        // Change values again
        width.set("300")
        dataTest.set("final-value")

        await nextFrame()

        // Verify attributes didn't change after cleanup
        expect(element.getAttribute("width")).toBe("200")
        expect(element.getAttribute("data-test")).toBe("new-value")
    })
})
