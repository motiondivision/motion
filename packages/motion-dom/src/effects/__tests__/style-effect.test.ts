import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { styleEffect } from "../style"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("styleEffect", () => {
    it("sets styles after styleEffect is applied", async () => {
        const element = document.createElement("div")

        // Create motion values
        const width = motionValue("100px")
        const height = motionValue(101)
        const color = motionValue("red")
        const testVar = motionValue(100)

        // Apply style effect
        styleEffect(element, {
            width,
            height,
            color,
            "--test-var": testVar,
        })

        await nextFrame()

        // Verify styles are set
        expect(element.style.width).toBe("100px")
        expect(element.style.height).toBe("101px")
        expect(element.style.color).toBe("red")
        expect(element.style.getPropertyValue("--test-var")).toBe("100")
    })

    it("updates styles when motion values change", async () => {
        const element = document.createElement("div")

        // Create motion values
        const width = motionValue("100px")
        const color = motionValue("red")
        const testVar = motionValue(100)

        // Apply style effect
        styleEffect(element, {
            width,
            color,
            "--test-var": testVar,
        })

        await nextFrame()

        // Verify initial styles
        expect(element.style.width).toBe("100px")
        expect(element.style.color).toBe("red")
        expect(element.style.getPropertyValue("--test-var")).toBe("100")

        // Change motion values
        width.set("200px")
        color.set("blue")
        testVar.set(200)

        // Updates should be scheduled for the next frame render
        // Styles should not have changed yet
        expect(element.style.width).toBe("100px")
        expect(element.style.color).toBe("red")
        expect(element.style.getPropertyValue("--test-var")).toBe("100")

        await nextFrame()

        // Verify styles are updated
        expect(element.style.width).toBe("200px")
        expect(element.style.color).toBe("blue")
        expect(element.style.getPropertyValue("--test-var")).toBe("200")
    })

    it("supports independent transform values", async () => {
        const element = document.createElement("div")

        // Create motion values
        const x = motionValue("100%")
        const transformPerspective = motionValue(500)
        const scaleY = motionValue(2)

        // Apply style effect
        styleEffect(element, {
            x,
            transformPerspective,
            scaleY,
        })

        await nextFrame()

        // Verify initial styles
        expect(element.style.transform).toBe(
            "perspective(500px) translateX(100%) scaleY(2)"
        )

        // Change motion values
        x.set("50%")
        transformPerspective.set(1000)
        scaleY.set(1.5)

        // Updates should be scheduled for the next frame render
        // Styles should not have changed yet
        expect(element.style.transform).toBe(
            "perspective(500px) translateX(100%) scaleY(2)"
        )

        await nextFrame()

        // Verify styles are updated
        expect(element.style.transform).toBe(
            "perspective(1000px) translateX(50%) scaleY(1.5)"
        )
    })

    it("only updates transform style once per frame", async () => {
        const element = document.createElement("div")

        // Create motion values
        const x = motionValue("100%")
        const y = motionValue("0%")
        const scale = motionValue(1)

        // Mock the transform setter
        const originalSetter = Object.getOwnPropertyDescriptor(
            CSSStyleDeclaration.prototype,
            "transform"
        )?.set

        const mockSetter = jest.fn()
        Object.defineProperty(element.style, "transform", {
            set: mockSetter,
            configurable: true,
        })

        // Apply style effect
        styleEffect(element, {
            x,
            y,
            scale,
        })

        await nextFrame()

        // Should be called once for initial values
        expect(mockSetter).toHaveBeenCalledTimes(1)
        mockSetter.mockClear()

        // Change multiple motion values in the same frame
        x.set("50%")
        y.set("25%")
        scale.set(2)

        // Should not have been called yet
        expect(mockSetter).not.toHaveBeenCalled()

        await nextFrame()

        // Should only be called once despite multiple value changes
        expect(mockSetter).toHaveBeenCalledTimes(1)

        // Restore original setter
        if (originalSetter) {
            Object.defineProperty(element.style, "transform", {
                set: originalSetter,
                configurable: true,
            })
        }
    })

    it("supports independent transform values split across multiple styleEffects", async () => {
        const element = document.createElement("div")

        // Create motion values
        const x = motionValue("100%")
        const transformPerspective = motionValue(500)
        const scaleY = motionValue(2)

        // Apply style effect
        styleEffect(element, { x })
        styleEffect(element, { transformPerspective, scaleY })

        await nextFrame()

        // Verify initial styles
        expect(element.style.transform).toBe(
            "perspective(500px) translateX(100%) scaleY(2)"
        )

        // Change motion values
        x.set("50%")
        transformPerspective.set(1000)
        scaleY.set(1)

        // Updates should be scheduled for the next frame render
        // Styles should not have changed yet
        expect(element.style.transform).toBe(
            "perspective(500px) translateX(100%) scaleY(2)"
        )

        await nextFrame()

        // Verify styles are updated
        expect(element.style.transform).toBe(
            "perspective(1000px) translateX(50%)"
        )
    })

    it("handles multiple elements", async () => {
        // Create additional elements
        const element = document.createElement("div")
        const element2 = document.createElement("div")

        const margin = motionValue("10px")
        const backgroundColor = motionValue("yellow")

        styleEffect([element, element2], {
            margin,
            backgroundColor,
        })

        await nextFrame()

        expect(element.style.margin).toBe("10px")
        expect(element.style.backgroundColor).toBe("yellow")
        expect(element2.style.margin).toBe("10px")
        expect(element2.style.backgroundColor).toBe("yellow")

        margin.set("20px")
        backgroundColor.set("green")

        await nextFrame()

        expect(element.style.margin).toBe("20px")
        expect(element.style.backgroundColor).toBe("green")
    })

    it("returns cleanup function that stops updating styles", async () => {
        const element = document.createElement("div")
        // Create motion values
        const padding = motionValue("5px")
        const opacity = motionValue("0.5")

        // Apply style effect and get cleanup function
        const cleanup = styleEffect(element, {
            padding,
            opacity,
        })

        await nextFrame()

        // Verify initial styles
        expect(element.style.padding).toBe("5px")
        expect(element.style.opacity).toBe("0.5")

        // Change values and verify update on next frame
        padding.set("10px")
        opacity.set("0.8")

        await nextFrame()

        // Verify update happened
        expect(element.style.padding).toBe("10px")
        expect(element.style.opacity).toBe("0.8")

        // Call cleanup function
        cleanup()

        // Change values again
        padding.set("15px")
        opacity.set("1")

        await nextFrame()

        // Verify styles didn't change after cleanup
        expect(element.style.padding).toBe("10px")
        expect(element.style.opacity).toBe("0.8")
    })

    it("returns cleanup function that stops updating styles that have already been scheduled", async () => {
        const element = document.createElement("div")

        // Create motion values
        const padding = motionValue("5px")
        const opacity = motionValue("0.5")
        const x = motionValue("0px")
        const y = motionValue("0px")

        // Apply style effect and get cleanup function for the first set of properties
        const cleanup = styleEffect(element, {
            padding,
            opacity,
            x,
        })

        // Apply a second style effect that won't be cleaned up
        styleEffect(element, {
            y,
        })

        await nextFrame()

        // Verify initial styles
        expect(element.style.padding).toBe("5px")
        expect(element.style.opacity).toBe("0.5")
        expect(element.style.transform).toBe("none")

        // Change values and verify update on next frame
        padding.set("10px")
        opacity.set("0.8")
        x.set("20px")
        y.set("30px")

        await nextFrame()

        // Verify update happened
        expect(element.style.padding).toBe("10px")
        expect(element.style.opacity).toBe("0.8")
        expect(element.style.transform).toBe(
            "translateX(20px) translateY(30px)"
        )

        // Change values again
        padding.set("15px")
        opacity.set("1")
        x.set("40px")
        y.set("50px")

        // Call cleanup function
        cleanup()

        // Check that values don't update on the next frame
        await nextFrame()

        // Verify styles didn't change after cleanup for the first style effect
        expect(element.style.padding).toBe("10px")
        expect(element.style.opacity).toBe("0.8")

        // But transform should still update since its style effect wasn't cleaned up
        expect(element.style.transform).toBe(
            "translateX(40px) translateY(50px)"
        )
    })

    it("handles transform origin values", async () => {
        const element = document.createElement("div")

        // Create motion values
        const originX = motionValue("0%")
        const originY = motionValue("100%")
        const originZ = motionValue(100)

        // Apply style effect
        styleEffect(element, {
            originX,
            originY,
            originZ,
        })

        await nextFrame()

        // Verify initial styles
        expect(element.style.transformOrigin).toBe("0% 100% 100px")

        // Change motion values
        originX.set("50%")
        originY.set("50%")
        originZ.set(0)

        await nextFrame()

        // Verify styles are updated
        expect(element.style.transformOrigin).toBe("50% 50% 0px")
    })

    it("uses default values for missing transform origin properties", async () => {
        const element = document.createElement("div")

        // Create motion values with only some origin properties
        const originX = motionValue("25%")

        // Apply style effect
        styleEffect(element, {
            originX,
        })

        await nextFrame()

        // Verify default values are used for missing properties
        expect(element.style.transformOrigin).toBe("25% 50% 0")
    })

    it("combines transform and transform origin values", async () => {
        const element = document.createElement("div")

        // Create motion values
        const x = motionValue("100px")
        const originX = motionValue("0%")
        const originY = motionValue("100%")

        // Apply style effect
        styleEffect(element, {
            x,
            originX,
            originY,
        })

        await nextFrame()

        // Verify both transform and transform origin are set
        expect(element.style.transform).toBe("translateX(100px)")
        expect(element.style.transformOrigin).toBe("0% 100% 0")

        // Change values
        x.set("200px")
        originX.set("50%")
        originY.set("50%")

        await nextFrame()

        // Verify both properties update
        expect(element.style.transform).toBe("translateX(200px)")
        expect(element.style.transformOrigin).toBe("50% 50% 0")
    })

    it("converts numerical transform origin values to percentages", async () => {
        const element = document.createElement("div")

        // Create motion values with numerical values
        const originX = motionValue(0.25)
        const originY = motionValue(0.75)
        const originZ = motionValue(100)

        // Apply style effect
        styleEffect(element, {
            originX,
            originY,
            originZ,
        })

        await nextFrame()

        // Verify numerical values are converted to percentages
        expect(element.style.transformOrigin).toBe("25% 75% 100px")

        // Change to different numerical values
        originX.set(0.5)
        originY.set(0.1)

        await nextFrame()

        // Verify updated values are converted to percentages
        expect(element.style.transformOrigin).toBe("50% 10% 100px")
    })

    it("handles mixed numerical and string transform origin values", async () => {
        const element = document.createElement("div")

        // Create motion values with mixed types
        const originX = motionValue(0.5)
        const originY = motionValue("100%")
        const originZ = motionValue(0)

        // Apply style effect
        styleEffect(element, {
            originX,
            originY,
            originZ,
        })

        await nextFrame()

        // Verify mixed values are handled correctly
        expect(element.style.transformOrigin).toBe("50% 100% 0px")
    })
})
