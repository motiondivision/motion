import { ElementOrSelector, resolveElements } from "../../utils/resolve-elements"

let nameCount = 0

/**
 * Resolve a selector/Element to elements and ensure each one carries a
 * `view-transition-name` we can target from script.
 *
 * Author-defined names are reused as-is. Elements that are unnamed (or use
 * the browser's `auto`/`match-element`, whose generated name is not exposed
 * to script) are given a unique generated name, set inline so it's captured,
 * and tracked in `assigned` for later cleanup.
 *
 * `registry` maps each Element to its name so the same element keeps its name
 * across both captures (before and after the update), which is what allows a
 * persistent element to animate as a single `group` layer.
 */
export function assignViewTransitionNames(
    definition: ElementOrSelector,
    registry: Map<Element, string>,
    assigned: Element[],
    scope?: Element
): string[] {
    const elements = resolveElements(
        definition,
        scope ? { current: scope, animations: [] } : undefined
    )

    return elements.map((element) => {
        const existing = registry.get(element)
        if (existing) return existing

        const current = getComputedStyle(element).getPropertyValue(
            "view-transition-name"
        )

        let name: string
        if (current && current !== "none" && current !== "auto") {
            /**
             * The author already named this layer - target it as-is and leave
             * it to them to clean up.
             */
            name = current
        } else {
            name = `motion-view-${nameCount++}`
            ;(element as HTMLElement).style?.setProperty(
                "view-transition-name",
                name
            )
            assigned.push(element)
        }

        registry.set(element, name)

        return name
    })
}

/**
 * Remove every generated `view-transition-name`. Safe to call more than once
 * (e.g. on both a finished and an interrupted transition).
 */
export function releaseViewTransitionNames(assigned: Element[]): void {
    for (const element of assigned) {
        ;(element as HTMLElement).style?.removeProperty("view-transition-name")
    }
}
