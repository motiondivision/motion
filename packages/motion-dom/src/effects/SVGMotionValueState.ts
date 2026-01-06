import { camelToDash } from "../render/dom/utils/camel-to-dash"
import { frame } from "../frameloop/frame"
import { MotionValue } from "../value"
import { px } from "../value/types/numbers/units"
import { HTMLMotionValueState, HTMLMotionValueStateOptions } from "./HTMLMotionValueState"

const toPx = px.transform!

export interface SVGMotionValueStateOptions extends HTMLMotionValueStateOptions {
    isSVGTag?: boolean
}

export class SVGMotionValueState extends HTMLMotionValueState {
    private isSVGTag: boolean

    constructor(options: SVGMotionValueStateOptions) {
        super(options)
        this.isSVGTag = options.isSVGTag ?? false
    }

    setIsSVGTag(isSVGTag: boolean) {
        this.isSVGTag = isSVGTag
    }

    override add(
        key: string,
        value: MotionValue,
        useDefaultValueType = true
    ): VoidFunction {
        const element = this.element
        if (!element) {
            return super.add(key, value, useDefaultValueType)
        }

        // Handle SVG path properties
        if (key.startsWith("path")) {
            return this.addSVGPathValue(element, key, value)
        }

        // Handle attr* properties (attrX, attrY, attrScale)
        if (key.startsWith("attr")) {
            const attrKey = this.convertAttrKey(key)
            return this.addAttrValue(element, attrKey, value)
        }

        // For SVG tags (like <svg> itself), use HTML-style handling
        if (this.isSVGTag) {
            return super.add(key, value, useDefaultValueType)
        }

        // For SVG elements, check if property is style-compatible
        if (key in element.style) {
            return super.add(key, value, useDefaultValueType)
        }

        // Otherwise, use attribute
        return this.addAttrValue(element, key, value)
    }

    private addSVGPathValue(
        element: HTMLElement | SVGElement,
        key: string,
        value: MotionValue
    ): VoidFunction {
        // Set pathLength to 1 for normalized path animations
        frame.render(() => element.setAttribute("pathLength", "1"))

        if (key === "pathOffset") {
            return this.set(key, value, () => {
                element.setAttribute(
                    "stroke-dashoffset",
                    toPx(-this.latest[key] as number)
                )
                this.onUpdate?.()
            })
        } else {
            // pathLength or pathSpacing - share computed stroke-dasharray
            if (!this.get("stroke-dasharray")) {
                this.set("stroke-dasharray", new MotionValue("1 1"), () => {
                    const pathLength = (this.latest.pathLength ?? 1) as number
                    const pathSpacing = this.latest.pathSpacing as number | undefined

                    element.setAttribute(
                        "stroke-dasharray",
                        `${toPx(pathLength)} ${toPx(pathSpacing ?? 1 - pathLength)}`
                    )
                    this.onUpdate?.()
                })
            }

            return this.set(
                key,
                value,
                undefined,
                this.get("stroke-dasharray")
            )
        }
    }

    private addAttrValue(
        element: HTMLElement | SVGElement,
        key: string,
        value: MotionValue
    ): VoidFunction {
        const isProp = this.canSetAsProperty(element, key)
        const name = isProp
            ? key
            : key.startsWith("data") || key.startsWith("aria")
            ? camelToDash(key)
            : key

        const render = isProp
            ? () => {
                  ;(element as any)[name] = this.latest[key]
                  this.onUpdate?.()
              }
            : () => {
                  const v = this.latest[key]
                  if (v === null || v === undefined) {
                      element.removeAttribute(name)
                  } else {
                      element.setAttribute(name, String(v))
                  }
                  this.onUpdate?.()
              }

        return this.set(key, value, render)
    }

    private canSetAsProperty(element: HTMLElement | SVGElement, name: string): boolean {
        if (!(name in element)) return false

        const descriptor =
            Object.getOwnPropertyDescriptor(
                Object.getPrototypeOf(element),
                name
            ) || Object.getOwnPropertyDescriptor(element, name)

        return descriptor !== undefined && typeof descriptor.set === "function"
    }

    private convertAttrKey(key: string): string {
        return key.replace(/^attr([A-Z])/, (_, firstChar) =>
            firstChar.toLowerCase()
        )
    }
}
