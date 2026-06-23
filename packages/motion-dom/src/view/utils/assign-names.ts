import { ElementOrSelector, resolveElements } from "../../utils/resolve-elements"

let nameCount = 0

/**
 * Generated names live in their own namespace so we can tell a name we own
 * (and must clean up) from an author-defined one - and so a stale generated
 * name left behind by an interrupted transition is re-owned, not mistaken for
 * the author's and leaked.
 */
const generatedName = () => `motion-view-${nameCount++}`

const isGeneratedName = (name: string) => name.startsWith("motion-view-")

/**
 * Tag a captured element with a `view-transition-class` so authors can target
 * its generated layer from CSS (e.g. `::view-transition-group(.hero)`) without
 * the opaque generated name. Tracked in `classed` - separate from the generated
 * names in `assigned` - so cleanup removes the class without ever stripping an
 * author's own inline `view-transition-name`.
 */
function tagClass(
    element: Element,
    className: string | undefined,
    classed: Element[]
) {
    if (!className) return
    ;(element as HTMLElement).style?.setProperty(
        "view-transition-class",
        className
    )
    classed.push(element)
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
    className?: string,
    classed: Element[] = []
): string[] {
    const elements = resolveElements(definition)

    /**
     * The new end of a paired morph: give each element the matching name from
     * the old end (by index) so the two share one layer and morph. If the new
     * end resolves to *more* elements than the old end named, the extras have no
     * counterpart - give them a fresh name so they animate as newcomers rather
     * than being silently left unnamed. We return the names actually assigned
     * (sized to the resolved elements), not the raw `forcedNames`, so stagger
     * totals and the layer set stay in step with what's on the page.
     */
    if (forcedNames) {
        return elements.map((element, i) => {
            const existing = registry.get(element)
            if (existing) return existing

            const name = forcedNames[i] ?? generatedName()
            ;(element as HTMLElement).style?.setProperty(
                "view-transition-name",
                name
            )
            assigned.push(element)
            registry.set(element, name)
            tagClass(element, className, classed)

            return name
        })
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
            current !== "match-element" &&
            !isGeneratedName(current)
        ) {
            /**
             * The author already named this layer - target it as-is and leave
             * it to them to clean up. `auto`/`match-element` are overridden
             * because their generated name is not exposed to script, and a
             * stale `motion-view-*` (e.g. left by an interrupted transition) is
             * re-owned rather than adopted as an author name and leaked.
             */
            name = current
        } else {
            name = generatedName()
            ;(element as HTMLElement).style?.setProperty(
                "view-transition-name",
                name
            )
            assigned.push(element)
        }

        registry.set(element, name)
        tagClass(element, className, classed)

        return name
    })
}

/**
 * Remove the `view-transition-name`s we generated and the
 * `view-transition-class`es we applied. Author-defined names are never touched
 * (they're not in `assigned`). Safe to call more than once (e.g. on both a
 * finished and an interrupted transition).
 */
export function releaseViewTransitionNames(
    assigned: Element[],
    classed: Element[] = []
): void {
    for (const element of assigned) {
        ;(element as HTMLElement).style?.removeProperty("view-transition-name")
    }
    for (const element of classed) {
        ;(element as HTMLElement).style?.removeProperty("view-transition-class")
    }
}
