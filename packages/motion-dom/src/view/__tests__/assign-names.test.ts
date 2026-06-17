import { animateView } from "../index"
import {
    assignViewTransitionNames,
    releaseViewTransitionNames,
} from "../utils/assign-names"

describe("assignViewTransitionNames", () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    test("resolves a selector to every match and names each uniquely", () => {
        const container = document.createElement("div")
        container.innerHTML =
            '<div class="item"></div><div class="item"></div><div class="item"></div>'
        document.body.appendChild(container)

        const registry = new Map<Element, string>()
        const assigned: Element[] = []
        const names = assignViewTransitionNames(".item", registry, assigned)

        expect(names).toHaveLength(3)
        expect(new Set(names).size).toBe(3)
        names.forEach((name) => expect(name).toMatch(/^motion-view-\d+$/u))

        expect(assigned).toHaveLength(3)
        expect(registry.size).toBe(3)
    })

    test("writes the generated name inline so it's captured", () => {
        const el = document.createElement("div")
        document.body.appendChild(el)
        // JSDOM's cssstyle drops unknown properties, so spy rather than read back.
        const setProperty = jest.spyOn(el.style, "setProperty")

        const registry = new Map<Element, string>()
        const assigned: Element[] = []
        const [name] = assignViewTransitionNames(el, registry, assigned)

        expect(setProperty).toHaveBeenCalledWith("view-transition-name", name)
    })

    test("reuses the same name for the same element across calls", () => {
        const el = document.createElement("div")
        document.body.appendChild(el)

        const registry = new Map<Element, string>()
        const assigned: Element[] = []

        const [first] = assignViewTransitionNames(el, registry, assigned)
        const [second] = assignViewTransitionNames(el, registry, assigned)

        expect(second).toBe(first)
        // The element is only assigned (and tracked for cleanup) once.
        expect(assigned).toHaveLength(1)
    })

    test("respects an author-defined view-transition-name", () => {
        const el = document.createElement("div")
        document.body.appendChild(el)

        const spy = jest
            .spyOn(window, "getComputedStyle")
            .mockReturnValue({
                getPropertyValue: () => "card",
            } as unknown as CSSStyleDeclaration)

        const registry = new Map<Element, string>()
        const assigned: Element[] = []
        const [name] = assignViewTransitionNames(el, registry, assigned)

        expect(name).toBe("card")
        expect(assigned).toHaveLength(0)
        expect(el.style.getPropertyValue("view-transition-name")).toBe("")

        spy.mockRestore()
    })

    // `auto`/`match-element` generate a name the browser keeps internal, so we
    // can't target it - they must be overridden with a name we control.
    test.each(["auto", "match-element"])(
        "overrides `%s`, whose generated name is not exposed to script",
        (keyword) => {
            const el = document.createElement("div")
            document.body.appendChild(el)

            const spy = jest
                .spyOn(window, "getComputedStyle")
                .mockReturnValue({
                    getPropertyValue: () => keyword,
                } as unknown as CSSStyleDeclaration)

            const registry = new Map<Element, string>()
            const assigned: Element[] = []
            const [name] = assignViewTransitionNames(el, registry, assigned)

            expect(name).toMatch(/^motion-view-\d+$/u)
            expect(assigned).toHaveLength(1)

            spy.mockRestore()
        }
    )

    test("release removes every generated name", () => {
        const el = document.createElement("div")
        document.body.appendChild(el)
        const removeProperty = jest.spyOn(el.style, "removeProperty")

        const registry = new Map<Element, string>()
        const assigned: Element[] = []
        assignViewTransitionNames(el, registry, assigned)
        expect(assigned).toContain(el)

        releaseViewTransitionNames(assigned)

        expect(removeProperty).toHaveBeenCalledWith("view-transition-name")
    })
})

describe("animateView fallback (no startViewTransition)", () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    test("runs the update and resolves with an element target", async () => {
        // JSDOM has no startViewTransition, so this exercises the fallback.
        expect(document.startViewTransition).toBeUndefined()

        const el = document.createElement("div")
        document.body.appendChild(el)

        const update = jest.fn()
        // Awaiting the builder only resolves if the queue routes the resolved
        // GroupAnimation back to notifyReady, so this also covers `.then()`
        // settling in the fallback path.
        const result = await animateView(() => {
            update()
        })
            .add(el)
            .enter({ opacity: 1 })

        expect(update).toHaveBeenCalledTimes(1)
        expect(result).toBeDefined()
    })
})
