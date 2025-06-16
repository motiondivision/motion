import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { propEffect } from "../prop"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("propEffect", () => {
    it("sets properties after propEffect is applied", async () => {
        const subject: { [key: string]: any } = {}

        // Create motion values
        const width = motionValue(100)
        const height = motionValue(200)
        const testProp = motionValue("test-value")

        // Apply prop effect
        propEffect(subject, {
            width,
            height,
            testProp,
        })

        await nextFrame()

        // Verify properties are set
        expect(subject.width).toBe(100)
        expect(subject.height).toBe(200)
        expect(subject.testProp).toBe("test-value")
    })

    it("updates properties when motion values change", async () => {
        const subject: { [key: string]: any } = {}

        // Create motion values
        const width = motionValue(100)
        const testProp = motionValue("test-value")

        // Apply prop effect
        propEffect(subject, {
            width,
            testProp,
        })

        await nextFrame()

        // Verify initial properties
        expect(subject.width).toBe(100)
        expect(subject.testProp).toBe("test-value")

        // Change motion values
        width.set(200)
        testProp.set("new-value")

        // Updates should be scheduled for the next frame render
        // Properties should not have changed yet
        expect(subject.width).toBe(100)
        expect(subject.testProp).toBe("test-value")

        await nextFrame()

        // Verify properties are updated
        expect(subject.width).toBe(200)
        expect(subject.testProp).toBe("new-value")
    })

    it("returns cleanup function that stops updating properties", async () => {
        const subject: { [key: string]: any } = {}
        // Create motion values
        const width = motionValue(100)
        const testProp = motionValue("test-value")

        // Apply prop effect and get cleanup function
        const cleanup = propEffect(subject, {
            width,
            testProp,
        })

        await nextFrame()

        // Verify initial properties
        expect(subject.width).toBe(100)
        expect(subject.testProp).toBe("test-value")

        // Change values and verify update on next frame
        width.set(200)
        testProp.set("new-value")

        await nextFrame()

        // Verify update happened
        expect(subject.width).toBe(200)
        expect(subject.testProp).toBe("new-value")

        // Call cleanup function
        cleanup()

        // Change values again
        width.set(300)
        testProp.set("final-value")

        await nextFrame()

        // Verify properties didn't change after cleanup
        expect(subject.width).toBe(200)
        expect(subject.testProp).toBe("new-value")
    })
})
