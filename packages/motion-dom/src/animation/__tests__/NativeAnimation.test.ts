import { NativeAnimation } from "../NativeAnimation"

describe("NativeAnimation", () => {
    describe("commitStyles", () => {
        test("should not throw when element is removed from DOM before stop()", () => {
            // Create a test element
            const element = document.createElement("div")
            document.body.appendChild(element)

            // Create animation
            const animation = new NativeAnimation({
                element,
                name: "opacity",
                keyframes: [0, 1],
                duration: 1000,
            })

            // Remove element from DOM
            document.body.removeChild(element)

            // stop() calls commitStyles() internally - this should not throw
            expect(() => animation.stop()).not.toThrow()
        })

        test("should commit styles when element is in DOM", () => {
            // Create a test element
            const element = document.createElement("div")
            document.body.appendChild(element)

            // Create animation
            const animation = new NativeAnimation({
                element,
                name: "opacity",
                keyframes: [0, 1],
                duration: 1000,
            })

            // stop() should work without throwing when element is in DOM
            expect(() => animation.stop()).not.toThrow()

            // Cleanup
            document.body.removeChild(element)
        })
    })
})
