/**
 * Read a WebGL canvas' pixels in CSS pixel coordinates, from its top-left.
 */
export function readCanvas(canvas) {
    const gl = canvas.getContext("webgl2")
    const { width, height } = canvas
    const data = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
    const scale = width / canvas.clientWidth

    const at = (x, y) => {
        const px = Math.floor(x * scale)
        const py = height - 1 - Math.floor(y * scale)
        const i = (py * width + px) * 4
        return Array.from(data.subarray(i, i + 4))
    }

    /**
     * Alpha along a row, one value per CSS pixel.
     */
    const alphaRow = (y, from = 0, to = canvas.clientWidth) => {
        const row = []
        for (let x = from; x < to; x++) row.push(at(x + 0.5, y)[3])
        return row
    }

    return { at, alphaRow }
}

/**
 * Wait for the layer's next frame and read the canvas inside that same
 * paint, before anything else can draw over it.
 */
export const nextRender = (layer, read = readCanvas) =>
    new Promise((resolve) => {
        const stop = layer.onRender(() => {
            stop()
            resolve(read(layer.canvas))
        })
        layer.invalidate()
    })
