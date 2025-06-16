import "../../../../jest.setup"
import { animateMini } from "../animate-style"
import "./polyfill"

/**
 * TODO: All tests currently have to define at least two keyframes
 * because the polyfill doesn't support partial keyframes.
 */
const duration = 0.001

describe("animateMini", () => {
    test("No type errors", async () => {
        const div = document.createElement("div")
        animateMini(
            div,
            { opacity: 0.6, "--css-var": 2 },
            {
                duration,
                "--css-var": {
                    repeatType: "mirror",
                },
                repeat: 0,
                ease: "easeOut",
                times: [0],
            }
        )
    })

    test("time sets and gets time", async () => {
        const div = document.createElement("div")
        const animation = animateMini(div, { opacity: 0.5 }, { duration: 10 })

        expect(animation.time).toBe(0)
        animation.time = 5
        expect(animation.time).toBe(5)
    })

    test("Interrupt polyfilled transforms", async () => {
        const div = document.createElement("div")
        animateMini(div, { x: 300 }, { duration: 1 })

        const promise = new Promise<string | undefined>((resolve) => {
            setTimeout(() => {
                const animation = animateMini(div, { x: 0 }, { duration: 1 })
                setTimeout(() => {
                    animation.stop()
                    resolve(div.style.getPropertyValue("--motion-translateX"))
                }, 50)
            }, 100)
        })

        return expect(promise).resolves.not.toBe("0px")
    })
})
