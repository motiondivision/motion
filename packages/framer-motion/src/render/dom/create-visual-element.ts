import { HTMLVisualElement, SVGVisualElement } from "motion-dom"
import { ComponentType, Fragment } from "react"
import { CreateVisualElement, VisualElementOptions } from "../types"
import { isSVGComponent } from "./utils/is-svg-component"

export const createDomVisualElement: CreateVisualElement = (
    Component: string | ComponentType<React.PropsWithChildren<unknown>>,
    options: VisualElementOptions<HTMLElement | SVGElement>
) => {
    /**
     * Use explicit isSVG override if provided, otherwise auto-detect
     */
    const isSVG = options.isSVG ?? isSVGComponent(Component)

    return isSVG
        ? new SVGVisualElement(options)
        : new HTMLVisualElement(options, {
              allowProjection: Component !== Fragment,
          })
}
