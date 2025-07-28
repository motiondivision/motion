import { ComponentType, Fragment } from "react"
import { HTMLVisualElement } from "../html/HTMLVisualElement"
import { SVGVisualElement } from "../svg/SVGVisualElement"
import { CreateVisualElement, VisualElementOptions } from "../types"
import { isSVGComponent } from "./utils/is-svg-component"

export const createDomVisualElement: CreateVisualElement = (
    Component: string | ComponentType<React.PropsWithChildren<unknown>>,
    options: VisualElementOptions
) => {
    return isSVGComponent(Component)
        ? new SVGVisualElement(options)
        : new HTMLVisualElement(options, {
              allowProjection: Component !== Fragment,
          })
}
