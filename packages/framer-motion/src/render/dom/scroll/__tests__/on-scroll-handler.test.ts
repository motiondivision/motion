import { createScrollInfo } from "../info"
import { createOnScrollHandler } from "../on-scroll-handler"

describe("on-scroll-handler static-position warning", () => {
    let consoleWarnSpy: jest.SpyInstance
    let getComputedStyleSpy: jest.SpyInstance

    beforeEach(() => {
        consoleWarnSpy = jest
            .spyOn(console, "warn")
            .mockImplementation(() => {})
        getComputedStyleSpy = jest
            .spyOn(window, "getComputedStyle")
            .mockReturnValue({
                position: "static",
            } as CSSStyleDeclaration)
    })

    afterEach(() => {
        consoleWarnSpy.mockRestore()
        getComputedStyleSpy.mockRestore()
    })

    const didWarn = () =>
        consoleWarnSpy.mock.calls.some((args) =>
            args.some(
                (arg: unknown) =>
                    typeof arg === "string" &&
                    arg.includes("non-static position")
            )
        )

    const measureWith = (container: Element, target: Element) => {
        const handler = createOnScrollHandler(
            container,
            () => {},
            createScrollInfo(),
            { target }
        )
        handler.measure(createScrollInfo())
    }

    test("does not warn when container is document.documentElement", () => {
        const target = document.createElement("div")
        document.body.appendChild(target)

        measureWith(document.documentElement, target)

        expect(didWarn()).toBe(false)
    })

    test("warns when a custom container has static position", () => {
        const container = document.createElement("div")
        const target = document.createElement("div")
        container.appendChild(target)
        document.body.appendChild(container)

        measureWith(container, target)

        expect(didWarn()).toBe(true)
    })
})
