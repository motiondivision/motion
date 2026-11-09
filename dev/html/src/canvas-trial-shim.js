/**
 * Dev and test only. Not part of motion/canvas.
 *
 * motion/canvas targets HTML-in-canvas as shipped in Chrome 157:
 * <canvas content="drawable">, updateElementGeometry() and
 * texElementSubImage2D(). The origin trial (Chromium 138-156, behind
 * --enable-blink-features=CanvasDrawElement) has an older shape:
 * <canvas layoutsubtree>, hit testing through the element's own CSS
 * transform, and texElementImage2D(). This maps the shipped names onto the
 * trial so the library's single code path can be tested in those builds.
 *
 * Returns "native", "trial" or "none".
 */
export function installTrialShim() {
    const Canvas = HTMLCanvasElement.prototype

    if ("updateElementGeometry" in Canvas) return "native"
    if (!("layoutSubtree" in Canvas)) return "none"

    Object.defineProperty(Canvas, "content", {
        configurable: true,
        get() {
            const isDrawable = this.getAttribute("content") === "drawable"
            if (this.layoutSubtree !== isDrawable) {
                this.layoutSubtree = isDrawable
            }
            return isDrawable ? "drawable" : "fallback"
        },
        set(value) {
            this.setAttribute("content", value)
            this.layoutSubtree = value === "drawable"
        },
    })

    const setTransform = (element, transform, pointerEvents) => {
        const { style } = element
        style.pointerEvents = pointerEvents
        if (element.__trialTransform !== transform) {
            element.__trialTransform = transform
            style.transformOrigin = "0 0"
            style.transform = transform
        }
    }

    /**
     * The trial hit tests through the element's CSS transform, from its
     * layout position. The canvasTransform maps its border box to the
     * canvas, so it's offset by where the element is laid out.
     */
    Canvas.updateElementGeometry = function (element, { canvasTransform }) {
        const width = element.offsetWidth
        const height = element.offsetHeight
        const sameParent = element.offsetParent === this.offsetParent
        const left = sameParent
            ? element.offsetLeft - this.offsetLeft - this.clientLeft
            : 0
        const top = sameParent
            ? element.offsetTop - this.offsetTop - this.clientTop
            : 0

        /**
         * The trial only paints the part of an element its CSS transform
         * leaves inside the canvas box, so one that's partly outside keeps
         * an untransformed box, and loses hit testing, to stay whole.
         */
        for (const [x, y] of [
            [0, 0],
            [width, 0],
            [width, height],
            [0, height],
        ]) {
            const point = canvasTransform.transformPoint(new DOMPoint(x, y))
            if (
                point.x < -1 ||
                point.y < -1 ||
                point.x > this.clientWidth + 1 ||
                point.y > this.clientHeight + 1
            ) {
                return this.clearElementGeometry(element)
            }
        }

        const transform = new DOMMatrix()
            .translate(-left, -top)
            .multiply(canvasTransform)
        setTransform(element, transform.toString(), "")
    }

    Canvas.clearElementGeometry = function (element) {
        setTransform(element, "none", "none")
    }

    Canvas.getElementImageDefaultSize = function (element) {
        return {
            width: element.offsetWidth * (this.width / this.clientWidth),
            height: element.offsetHeight * (this.height / this.clientHeight),
        }
    }

    const GL = WebGL2RenderingContext.prototype
    GL.texElementSubImage2D = function (target, level, x, y, element) {
        this.texElementImage2D(target, this.RGBA8, element)
    }

    /**
     * The trial's changedElements misses changes, so hide it: the layer
     * then uploads every element each paint.
     */
    const listeners = new WeakMap()
    const add = Canvas.addEventListener
    const remove = Canvas.removeEventListener
    Canvas.addEventListener = function (type, listener, options) {
        if (type !== "paint" || typeof listener !== "function") {
            return add.call(this, type, listener, options)
        }
        let wrapped = listeners.get(listener)
        if (!wrapped) {
            wrapped = function (event) {
                Object.defineProperty(event, "changedElements", {
                    value: undefined,
                    configurable: true,
                })
                return listener.call(this, event)
            }
            listeners.set(listener, wrapped)
        }
        return add.call(this, type, wrapped, options)
    }
    Canvas.removeEventListener = function (type, listener, options) {
        return remove.call(
            this,
            type,
            listeners.get(listener) || listener,
            options
        )
    }

    return "trial"
}
