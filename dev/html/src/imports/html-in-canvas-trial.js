/**
 * Dev and test only. Never import this from a package.
 *
 * Maps the shipped HTML-in-canvas API (Chrome 157) onto the origin trial
 * build (Chromium 138 to 156, behind --enable-blink-features=CanvasDrawElement),
 * so library code written against the shipped API runs in that build:
 *
 * - `content="drawable"` turns on the trial's `layoutsubtree`. Only direct
 *   children are drawn.
 * - `updateElementGeometry()` sets the element's own CSS transform, which
 *   the trial uses for hit testing.
 * - `texElementSubImage2D()` calls the trial's `texElementImage2D()`,
 *   which allocates its own storage.
 * - `CanvasPaintEvent.changedElements` is hidden, as the trial's isn't
 *   reliable, so callers upload every element on every paint.
 *
 * Does nothing without the trial, so a page without the flag sees no
 * HTML-in-canvas support.
 */
export function installHTMLInCanvasTrial() {
    const C = window.HTMLCanvasElement.prototype
    if ("updateElementGeometry" in C) return "shipped"
    if (!("layoutSubtree" in C)) return "none"

    Object.defineProperty(C, "content", {
        configurable: true,
        get() {
            return this.layoutSubtree ? "drawable" : "fallback"
        },
        set(value) {
            this.setAttribute("content", value)
            this.layoutSubtree = value === "drawable"
        },
    })

    const setTransform = (element, value) => {
        if (element.style.transform === value) return
        element.style.transformOrigin = "0 0"
        element.style.transform = value
    }

    C.updateElementGeometry = function (element, { canvasTransform } = {}) {
        if (!canvasTransform) return
        const m = DOMMatrix.fromMatrix(canvasTransform)

        /**
         * The trial only paints the part of an element that its CSS
         * transform leaves inside the canvas. Partly outside: paint it
         * whole, and skip hit testing.
         */
        const w = element.offsetWidth
        const h = element.offsetHeight
        for (const [x, y] of [
            [0, 0],
            [w, 0],
            [w, h],
            [0, h],
        ]) {
            const p = m.transformPoint(new DOMPoint(x, y))
            const px = p.x / p.w
            const py = p.y / p.w
            if (
                px < -1 ||
                py < -1 ||
                px > this.clientWidth + 1 ||
                py > this.clientHeight + 1
            ) {
                return this.clearElementGeometry(element)
            }
        }

        element.style.pointerEvents = ""
        setTransform(element, m.toString())
    }

    C.clearElementGeometry = function (element) {
        element.style.pointerEvents = "none"
        setTransform(element, "none")
    }

    C.getElementImageDefaultSize = function (element) {
        const scale = this.width / this.clientWidth
        return {
            width: element.offsetWidth * scale,
            height: element.offsetHeight * scale,
        }
    }

    const Paint = window.CanvasPaintEvent
    if (Paint) {
        Object.defineProperty(Paint.prototype, "changedElements", {
            configurable: true,
            get: () => undefined,
        })
    }

    /**
     * The trial allocates storage itself, so keep the internal format that
     * the caller allocated with.
     */
    const GL = window.WebGL2RenderingContext.prototype
    const formats = new WeakMap()
    const texImage2D = GL.texImage2D
    GL.texImage2D = function (...args) {
        const texture = this.getParameter(this.TEXTURE_BINDING_2D)
        texture && formats.set(texture, args[2])
        return texImage2D.apply(this, args)
    }
    GL.texElementSubImage2D = function (target, level, x, y, element) {
        const texture = this.getParameter(this.TEXTURE_BINDING_2D)
        this.texElementImage2D(
            target,
            formats.get(texture) ?? this.RGBA8,
            element
        )
    }

    return "trial"
}
