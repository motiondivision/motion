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
 * Attributes: `motion-blur`, `samples` and `perspective` on the element, `shader` and
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
        static observedAttributes = ["motion-blur", "samples", "perspective"]

        layer?: CanvasLayer

        ready = Promise.resolve(false)

        private slotElement = document.createElement("slot")

        private canvas?: HTMLCanvasElement

        /**
         * The layer from when it's made, before it's ready to draw.
         */
        private created?: CanvasLayer

        private drawn = new Set<HTMLElement>()

        /**
         * Takes the children's place in the layout while they're in the
         * canvas, so the element keeps its size.
         */
        private spacer = document.createElement("div")

        /**
         * Styles for while the canvas is drawing.
         */
        private drawing = document.createElement("style")

        /**
         * The inline width and height each child had before it was given
         * the size of its layout box.
         */
        private sizes = new Map<HTMLElement, [string, string]>()

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
                ":host{display:block;position:relative}canvas{position:absolute;inset:0;width:100%;height:100%}"
            root.append(style, this.drawing, this.slotElement)
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
                this.shadowRoot!.append(this.spacer, canvas)
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
            this.spacer.remove()
            this.drawing.textContent = ""
            this.restoreSizes()
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
            /**
             * The same perspective for the children when they're
             * displayed as normal DOM.
             */
            const perspective = number(this, "perspective")
            if (perspective !== undefined) {
                this.style.perspective = perspective
                    ? perspective + "px"
                    : ""
            }

            const layer = this.layer || this.created
            if (!layer) return
            layer.motionBlur = number(this, "motion-blur") ?? 0
            layer.samples = number(this, "samples") ?? 24
            layer.perspective = perspective ?? 0
            layer.setShaders(this.fx)
        }

        private restoreSizes() {
            this.sizes.forEach(([width, height], { style }) => {
                style.width = width
                style.height = height
            })
            this.sizes.clear()
        }

        /**
         * Draw each child where the element's own CSS lays it out, at the
         * size that gives it, so nothing moves when the canvas takes
         * over. Children of a canvas aren't laid out against each other,
         * so they're measured with the slot outside it.
         */
        private sync = () => {
            const { layer, drawn, canvas, slotElement, spacer, sizes } = this
            if (!layer || !canvas) return

            this.drawing.textContent = ""
            canvas.style.display = spacer.style.display = "none"
            this.restoreSizes()
            this.shadowRoot!.append(slotElement)

            const style = getComputedStyle(this)
            const assigned = new Set(slotElement.assignedElements())
            const boxes = new Map<Element, [number, number]>()
            const pinned: [HTMLElement, string, string][] = []
            assigned.forEach((element) => {
                if (element instanceof HTMLElement) {
                    /**
                     * Offsets, not the bounding box, which can include
                     * where the canvas last drew the child.
                     */
                    boxes.set(element, [element.offsetLeft, element.offsetTop])
                    const { width, height } = getComputedStyle(element)
                    pinned.push([element, width, height])
                }
            })

            /**
             * The spacer takes the children's place in the layout. The
             * element's own display would lay it out as one of them, so
             * that's switched off while the canvas draws.
             */
            spacer.style.cssText = `width:${
                this.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight)
            }px;height:${
                this.clientHeight -
                parseFloat(style.paddingTop) -
                parseFloat(style.paddingBottom)
            }px`
            this.drawing.textContent = `:host{display:${
                style.display.startsWith("inline") ? "inline-" : ""
            }block!important}`

            /**
             * In the canvas, a child no longer gets its size from the
             * element's layout, so it's given the size it had.
             */
            pinned.forEach(([element, width, height]) => {
                sizes.set(element, [element.style.width, element.style.height])
                element.style.width = width
                element.style.height = height
            })

            canvas.style.display = ""
            canvas.append(slotElement)

            drawn.forEach((element) => {
                if (assigned.has(element)) return
                layer.remove(element)
                drawn.delete(element)
            })

            assigned.forEach((element) => {
                if (!(element instanceof HTMLElement)) return
                const [left, top] = boxes.get(element)!
                layer.add(element, {
                    left,
                    top,
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
