import { handOffElementState } from "../animation/animate/element"
import { hasTransform } from "../projection/utils/has-transform"
import { scaleCorrectors } from "../projection/styles/scale-correction"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import type { ResolvedValues } from "../render/types"
import { cornerRadiusProps } from "../utils/border-radius"
import { visualElementStore } from "../render/store"

/**
 * Set by animateLayout(), so the inline style tracking it needs isn't
 * bundled with drag() alone, which doesn't scale elements.
 */
export const inlineStyles: {
    track?: (element: HTMLElement, visualElement: HTMLVisualElement) => void
} = {}

/**
 * Get the VisualElement that imperative APIs like animateLayout() and
 * drag() render an element with, creating one if it has none, ready for
 * a projection node to be attached.
 */
export function resolveVisualElement(element: HTMLElement): HTMLVisualElement {
    let visualElement = visualElementStore.get(element) as
        | HTMLVisualElement
        | undefined

    if (!visualElement) {
        visualElement = new HTMLVisualElement(
            {
                props: {},
                presenceContext: null,
                visualState: {
                    latestValues: {},
                    renderState: {
                        transform: {},
                        transformOrigin: {},
                        style: {},
                        vars: {},
                    },
                },
            },
            { allowProjection: true }
        )

        /**
         * Values animate() has been rendering on this element move to
         * the VisualElement, so the layout animation composes with
         * them instead of overwriting them.
         */
        handOffElementState(element, visualElement)

        inlineStyles.track?.(element, visualElement)
    }

    /**
     * A first-time element may carry a projection transform in its
     * inline style (e.g. it was cloned from an element mid-animation).
     * That transform isn't tracked in latestValues so the engine can't
     * reset it before measuring - clear it now so the first layout
     * measurement isn't inflated.
     */
    if (element.style.transform && !hasTransform(visualElement.latestValues)) {
        element.style.transform = ""
    }

    return visualElement
}

/**
 * Layout animations scale-correct styles like borderRadius and boxShadow
 * from latestValues, which a motion component fills from its style prop.
 * Here, the element's inline style is the style prop: before each render,
 * adopt any inline value that differs from what the last render wrote, as
 * only the user can have changed it. What each render writes, including
 * the projection's corrected values, is recorded after it, so it's never
 * read back as the user's.
 */
export function trackInlineStyles(
    element: HTMLElement,
    visualElement: HTMLVisualElement
) {
    const written: ResolvedValues = {}
    const { render, latestValues } = visualElement

    /**
     * A shared element can be rendered with another's radius during a
     * crossfade. Give it a radius of its own, so that's cleared after.
     */
    if (element.dataset.layoutId !== undefined) latestValues.borderRadius = ""

    const sync = (adopt?: boolean) => {
        const style = element.style as any

        for (const key in scaleCorrectors) {
            const value = style[key]

            if (value === undefined) continue

            if (!adopt) {
                written[key] = value
            } else if (
                style.borderRadius &&
                (cornerRadiusProps as readonly string[]).includes(key)
            ) {
                /**
                 * A uniform radius is adopted as the shorthand alone, as
                 * corners would render over an animated shorthand.
                 */
                visualElement.hasValue(key) || delete latestValues[key]
            } else if (
                value !== (written[key] ?? "") &&
                !visualElement.hasValue(key)
            ) {
                latestValues[key] = value
            }
        }
    }

    visualElement.render = () => {
        sync(true)
        render()
        sync()
    }

    sync(true)
    sync()
}
