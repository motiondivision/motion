import { canvasLayer, type CanvasLayer } from "./layer"

export interface MotionCanvasOptions {
    /**
     * The element's tag name. Defaults to `motion-canvas`.
     */
    name?: string

    /**
     * Shaders that children can name with a `shader` attribute. See the
     * `shader` option of `layer.add()`.
     */
    shaders?: Record<string, string>
}

export interface MotionCanvasElement extends HTMLElement {
    /**
     * Whether the element is drawing its children in a canvas. Without
     * HTML-in-canvas support, they're displayed as normal DOM.
     */
    readonly supported: boolean

    /**
     * The element's canvas layer, while it's connected and supported.
     */
    readonly layer?: CanvasLayer
}

const number = (element: Element, name: string) => {
    const value = element.getAttribute(name)
    return value === null || isNaN(+value) ? undefined : +value
}

/**
 * Defines `<motion-canvas>`, a custom element that draws its children in a
 * canvas layer. `animate()` and `drag()` then animate what's drawn, with
 * motion blur and shaders.
 *
 * ```html
 * <motion-canvas motion-blur="0.5">
 *   <div class="card" shader="dissolve">Live HTML</div>
 * </motion-canvas>
 * ```
 *
 * The children stay children of the element, so they're displayed as
 * normal DOM in browsers without HTML-in-canvas.
 *
 * Attributes: `motion-blur` and `samples` on the element, `shader` and
 * `motion-blur` on its children.
 */
export function defineMotionCanvas({
    name = "motion-canvas",
    shaders = {},
}: MotionCanvasOptions = {}) {
    if (typeof customElements === "undefined" || customElements.get(name)) {
        return
    }

    class MotionCanvas extends HTMLElement implements MotionCanvasElement {
        static observedAttributes = ["motion-blur", "samples"]

        layer?: CanvasLayer

        private slotElement = document.createElement("slot")

        private canvas?: HTMLCanvasElement

        private drawn = new Set<HTMLElement>()

        constructor() {
            super()
            const root = this.attachShadow({ mode: "open" })
            const style = document.createElement("style")
            style.textContent =
                ":host{display:block}canvas{display:block;width:100%;height:100%}"
            root.append(style, this.slotElement)
            this.slotElement.addEventListener("slotchange", this.sync)
        }

        get supported() {
            return Boolean(this.layer)
        }

        connectedCallback() {
            const canvas = document.createElement("canvas")
            const layer = canvasLayer(canvas, {
                motionBlur: number(this, "motion-blur"),
                samples: number(this, "samples"),
            })
            if (!layer.supported) return

            /**
             * Slotted children are laid out as children of the canvas,
             * which makes them drawable, while staying where they are in
             * the document.
             */
            canvas.append(this.slotElement)
            this.shadowRoot!.append(canvas)
            this.canvas = canvas
            this.layer = layer
            this.sync()
        }

        disconnectedCallback() {
            if (!this.layer) return
            this.layer.destroy()
            this.shadowRoot!.append(this.slotElement)
            this.canvas!.remove()
            this.drawn.clear()
            this.layer = this.canvas = undefined
        }

        attributeChangedCallback() {
            const { layer } = this
            if (!layer) return
            layer.motionBlur = number(this, "motion-blur") ?? 0
            layer.samples = number(this, "samples") ?? 24
            layer.invalidate()
        }

        private sync = () => {
            const { layer, drawn } = this
            if (!layer) return

            const assigned = new Set(this.slotElement.assignedElements())

            drawn.forEach((element) => {
                if (assigned.has(element)) return
                layer.remove(element)
                drawn.delete(element)
            })

            assigned.forEach((element) => {
                if (!(element instanceof HTMLElement) || drawn.has(element)) {
                    return
                }
                layer.add(element, {
                    shader: shaders[element.getAttribute("shader")!],
                    motionBlur: number(element, "motion-blur"),
                })
                drawn.add(element)
            })
        }
    }

    customElements.define(name, MotionCanvas)
}
