import type { FXShader } from "./effects"
import { canvasLayer, type CanvasLayer } from "./layer"

export interface MotionFXOptions {
    /**
     * The element's tag name. Defaults to `motion-fx`.
     */
    name?: string

    /**
     * Shaders that children can name with a `shader` attribute. See the
     * `shader` option of `layer.add()`.
     */
    shaders?: Record<string, string>
}

export interface MotionFXElement extends HTMLElement {
    /**
     * Whether the element is drawing its children in a canvas. Without
     * HTML-in-canvas support, they're displayed as normal DOM.
     */
    readonly supported: boolean

    /**
     * The element's canvas layer, while it's connected and supported.
     */
    readonly layer?: CanvasLayer

    /**
     * Resolves once the canvas has taken over drawing the children, with
     * `false` if it won't. Until then they're displayed as normal DOM.
     */
    readonly ready: Promise<boolean>

    /**
     * Shaders run in order on everything the element draws, and
     * `motionBlur()`.
     *
     * ```javascript
     * element.shaders = [motionBlur(), chromaticAberration()]
     * ```
     */
    shaders: FXShader[]
}

const number = (element: Element, name: string) => {
    const value = element.getAttribute(name)
    return value === null || isNaN(+value) ? undefined : +value
}

/**
 * Defines `<motion-fx>`, a custom element that draws its children in a
 * canvas layer. `animate()` and `drag()` then animate what's drawn, with
 * motion blur and shaders.
 *
 * ```html
 * <motion-fx motion-blur="0.5">
 *   <div class="card" shader="dissolve">Live HTML</div>
 * </motion-fx>
 * ```
 *
 * The children stay children of the element, so they're displayed as
 * normal DOM in browsers without HTML-in-canvas.
 *
 * Attributes: `motion-blur` and `samples` on the element, `shader` and
 * `motion-blur` on its children. Shaders for the whole element are set
 * with its `shaders` property.
 */
export function defineMotionFX({
    name = "motion-fx",
    shaders = {},
}: MotionFXOptions = {}) {
    if (typeof customElements === "undefined" || customElements.get(name)) {
        return
    }

    class MotionFX extends HTMLElement implements MotionFXElement {
        static observedAttributes = ["motion-blur", "samples"]

        layer?: CanvasLayer

        ready = Promise.resolve(false)

        private slotElement = document.createElement("slot")

        private canvas?: HTMLCanvasElement

        /**
         * The layer from when it's made, before it's ready to draw.
         */
        private created?: CanvasLayer

        private drawn = new Set<HTMLElement>()

        private fx: FXShader[] = []

        get shaders() {
            return this.fx
        }

        set shaders(shaders: FXShader[]) {
            this.fx = shaders || []
            this.configure()
        }

        constructor() {
            super()
            const root = this.attachShadow({ mode: "open" })
            const style = document.createElement("style")
            style.textContent =
                ":host{display:block}canvas{display:block;width:100%}"
            root.append(style, this.slotElement)
            /**
             * Moving the slot fires slotchange too, so only a change to
             * the children themselves is synced.
             */
            this.slotElement.addEventListener("slotchange", () => {
                const assigned = this.slotElement.assignedElements()
                ;(assigned.length !== this.drawn.size ||
                    assigned.some(
                        (child) => !this.drawn.has(child as HTMLElement)
                    )) &&
                    this.sync()
            })
        }

        get supported() {
            return Boolean(this.layer)
        }

        connectedCallback() {
            /**
             * `shaders` set before the element was defined is a property
             * of its own, which hides the setter.
             */
            if (Object.prototype.hasOwnProperty.call(this, "shaders")) {
                const shaders = this.shaders
                delete (this as any).shaders
                this.shaders = shaders
            }

            const canvas = document.createElement("canvas")
            const layer = canvasLayer(canvas)
            if (!layer.supported) return

            this.canvas = canvas
            this.created = layer
            layer.onLost(() => this.canvas === canvas && this.release())

            /**
             * The children are displayed as normal DOM until the layer
             * can draw, which takes a few frames.
             */
            this.ready = layer.ready.then((isReady) => {
                if (!isReady || this.canvas !== canvas) return false
                this.layer = layer
                this.configure()
                this.shadowRoot!.append(canvas)
                this.observer.observe(this)
                this.sync()
                return true
            })
        }

        disconnectedCallback() {
            this.created?.destroy()
            this.release()
        }

        /**
         * Hand the children back to the DOM.
         */
        private release() {
            this.observer.disconnect()
            this.shadowRoot!.append(this.slotElement)
            this.canvas?.remove()
            this.drawn.clear()
            this.layer = this.created = this.canvas = undefined
        }

        attributeChangedCallback() {
            this.configure()
        }

        /**
         * A `motionBlur()` in `shaders` wins over the attributes.
         */
        private configure() {
            const layer = this.layer || this.created
            if (!layer) return
            layer.motionBlur = number(this, "motion-blur") ?? 0
            layer.samples = number(this, "samples") ?? 24
            layer.setShaders(this.fx)
        }

        /**
         * Draw each child where it's laid out as normal DOM, so nothing
         * moves when the canvas takes over. Children of a canvas aren't
         * laid out against each other, so they're measured with the slot
         * outside it.
         */
        private sync = () => {
            const { layer, drawn, canvas, slotElement } = this
            if (!layer || !canvas) return

            canvas.style.display = "none"
            this.shadowRoot!.append(slotElement)
            const origin = this.getBoundingClientRect()
            const assigned = new Set(slotElement.assignedElements())
            const boxes = new Map<Element, DOMRect>()
            assigned.forEach((element) =>
                boxes.set(element, element.getBoundingClientRect())
            )
            /**
             * The canvas takes the children's place in the layout, at
             * the size they gave the element.
             */
            canvas.style.height = `${this.clientHeight}px`
            canvas.style.display = ""
            canvas.append(slotElement)

            drawn.forEach((element) => {
                if (assigned.has(element)) return
                layer.remove(element)
                drawn.delete(element)
            })

            assigned.forEach((element) => {
                if (!(element instanceof HTMLElement)) return
                const box = boxes.get(element)!
                layer.add(element, {
                    left: box.left - origin.left - this.clientLeft,
                    top: box.top - origin.top - this.clientTop,
                    shader: shaders[element.getAttribute("shader")!],
                    motionBlur: number(element, "motion-blur"),
                })
                drawn.add(element)
            })
        }

        private observer = new ResizeObserver(this.sync)
    }

    customElements.define(name, MotionFX)
}
