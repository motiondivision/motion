import { ElementOrSelector, resolveElements } from "../../utils/resolve-elements"

let nameCount = 0

/**
 * Tag a captured element with a `view-transition-class` so authors can target
 * its generated layer from CSS (e.g. `::view-transition-group(.hero)`) without
 * the opaque generated name. Tracked in `assigned` so the inline class is
 * removed alongside the name on cleanup.
 */
function tagClass(
    element: Element,
    className: string | undefined,
    assigned: Element[]
) {
    if (!className) return
    ;(element as HTMLElement).style?.setProperty(
        "view-transition-class",
        className
    )
    if (!assigned.includes(element)) assigned.push(element)
}

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
    forcedNames?: string[],
    className?: string
): string[] {
    const elements = resolveElements(definition)

    /**
     * The new end of a paired morph: assign each element the matching name from
     * the old end (by index) so the two share one layer and morph, rather than
     * generating a fresh per-element name.
     */
    if (forcedNames) {
        elements.forEach((element, i) => {
            const name = forcedNames[i]
            if (name == null || registry.get(element) === name) return
            ;(element as HTMLElement).style?.setProperty(
                "view-transition-name",
                name
            )
            assigned.push(element)
            registry.set(element, name)
            tagClass(element, className, assigned)
        })

        return forcedNames
    }

    /**
     * Read every current name up front, before assigning any. Interleaving the
     * reads with the inline `setProperty` writes below would dirty styles
     * between reads and force a style recalc per element; batching the reads
     * keeps it to one. Elements already in the registry keep their name and
     * need no read.
     */
    const currentNames = elements.map((element) =>
        registry.has(element)
            ? undefined
            : getComputedStyle(element).getPropertyValue("view-transition-name")
    )

    return elements.map((element, i) => {
        const existing = registry.get(element)
        if (existing) return existing

        const current = currentNames[i]

        let name: string
        if (
            current &&
            current !== "none" &&
            current !== "auto" &&
            current !== "match-element"
        ) {
            /**
             * The author already named this layer - target it as-is and leave
             * it to them to clean up. `auto`/`match-element` are overridden
             * because their generated name is not exposed to script.
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
        tagClass(element, className, assigned)

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
        ;(element as HTMLElement).style?.removeProperty("view-transition-class")
    }
}
