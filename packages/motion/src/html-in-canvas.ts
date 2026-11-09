/**
 * HTML-in-canvas, as shipped in Chrome 157: `<canvas content="drawable">`,
 * `drawable` descendants, the `paint` event and element geometry. Typed
 * here as TypeScript's DOM types don't include it yet.
 *
 * https://github.com/WICG/html-in-canvas
 */
export interface DrawableCanvas extends HTMLCanvasElement {
    content: string
    requestPaint(): void
    getElementImageDefaultSize(element: Element): {
        width: number
        height: number
    }
    updateElementGeometry(
        element: Element,
        options: { canvasTransform: DOMMatrixInit }
    ): void
    clearElementGeometry(element: Element): void
}

export interface DrawableWebGLContext extends WebGL2RenderingContext {
    texElementSubImage2D(
        target: GLenum,
        level: GLint,
        xoffset: GLint,
        yoffset: GLint,
        element: Element
    ): void
}

export interface CanvasPaintEvent extends Event {
    readonly changedElements?: readonly Element[]
}

/**
 * Whether elements inside this canvas can be drawn into it and placed
 * with element geometry.
 */
export function supportsHTMLInCanvas(
    canvas: HTMLCanvasElement
): canvas is DrawableCanvas {
    return "updateElementGeometry" in canvas && "requestPaint" in canvas
}
