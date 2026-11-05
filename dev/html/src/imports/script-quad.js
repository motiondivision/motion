/**
 * Helpers for quad projection tests. An element's bounding box can't show
 * where a rotated or 3D-transformed element is, so these read its four
 * corners from zero-size probes pinned to them.
 */

/**
 * Quad projection is opt-in, so every page that uses these helpers
 * installs it.
 */
window.AnimateLayout?.setLayoutEngine(window.AnimateLayout.quadLayout)

function probe(element) {
    if (element.quadProbes) return element.quadProbes

    if (getComputedStyle(element).position === "static") {
        element.style.position = "relative"
    }

    element.quadProbes = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
    ].map(([x, y]) => {
        const dot = document.createElement("div")
        dot.style.cssText = `position: absolute; width: 0; height: 0; left: ${
            x * 100
        }%; top: ${
            y * 100
        }%; pointer-events: none; margin: 0; padding: 0; border: 0;`
        dot.dataset.quadProbe = ""
        element.appendChild(dot)
        return dot
    })

    return element.quadProbes
}

/**
 * The element's border box corners as visible, clockwise from top-left:
 * [x0, y0, x1, y1, x2, y2, x3, y3]. Probes sit in the padding box, so
 * elements under test shouldn't have borders.
 */
function corners(element) {
    const out = []
    for (const dot of probe(element)) {
        const { left, top } = dot.getBoundingClientRect()
        out.push(left, top)
    }
    return out
}

/**
 * Where the diagonals cross: the visible centre of a projected rectangle.
 */
function centre(quad) {
    const [x0, y0, , , x2, y2] = quad
    const [, , x1, y1, , , x3, y3] = quad
    const d = (x0 - x2) * (y1 - y3) - (y0 - y2) * (x1 - x3)
    const a = x0 * y2 - y0 * x2
    const b = x1 * y3 - y1 * x3
    return [
        (a * (x1 - x3) - (x0 - x2) * b) / d,
        (a * (y1 - y3) - (y0 - y2) * b) / d,
    ]
}

function mix(a, b, p) {
    return a.map((v, i) => v + (b[i] - v) * p)
}

/**
 * A rotated rectangle's centre, size and rotation (degrees) from its
 * corners.
 */
function describe(quad) {
    const [x0, y0, x1, y1, , , x3, y3] = quad
    const [cx, cy] = centre(quad)
    return {
        cx,
        cy,
        width: Math.hypot(x1 - x0, y1 - y0),
        height: Math.hypot(x3 - x0, y3 - y0),
        rotate: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI,
    }
}

/**
 * The corners of a rectangle centred on (cx, cy), rotated clockwise.
 */
function rectCorners({ cx, cy, width, height, rotate }) {
    const angle = (rotate * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const out = []
    for (const [x, y] of [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
    ]) {
        const dx = x * width
        const dy = y * height
        out.push(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos)
    }
    return out
}

/**
 * Where a rotated rectangle animating between two others is expected to
 * be: its centre, size and rotation each interpolate linearly.
 */
function mixRects(from, to, p) {
    const a = describe(from)
    const b = describe(to)
    let turn = b.rotate - a.rotate
    turn -= Math.round(turn / 360) * 360
    return rectCorners({
        cx: a.cx + (b.cx - a.cx) * p,
        cy: a.cy + (b.cy - a.cy) * p,
        width: a.width + (b.width - a.width) * p,
        height: a.height + (b.height - a.height) * p,
        rotate: a.rotate + turn * p,
    })
}

const format = (quad) => quad.map((v) => Math.round(v * 100) / 100).join(", ")

const reported = new Set()

/**
 * Flag a failure without touching the rest of the page. showError() appends
 * to body.innerHTML, which replaces every element and breaks any later
 * check that still holds a reference to one.
 */
function report(element, message) {
    element.dataset.layoutCorrect = "false"
    if (reported.has(message)) return
    reported.add(message)
    console.error(message)
    const note = document.createElement("p")
    note.style.cssText =
        "position: fixed; z-index: 1000; left: 0; color: black; margin: 0;"
    note.style.top = `${(reported.size - 1) * 20}px`
    note.textContent = message
    document.body.appendChild(note)
}

function matchCorners(element, expected, label = "", threshold = 0.5) {
    const actual = corners(element)
    const wrong = actual.some((v, i) => Math.abs(v - expected[i]) > threshold)
    if (wrong) {
        report(
            element,
            `${label} corners [${format(actual)}] don't match [${format(
                expected
            )}]`
        )
    }
    return !wrong
}

/**
 * Compare corners that weren't read from an element, like a canvas
 * plane's.
 */
function matchQuad(actual, expected, label = "", threshold = 0.5) {
    const wrong = actual.some(
        (v, i) => !(Math.abs(v - expected[i]) <= threshold)
    )
    if (wrong) {
        report(
            document.body,
            `${label} corners [${format(actual)}] don't match [${format(
                expected
            )}]`
        )
    }
    return !wrong
}

function check(condition, message) {
    if (!condition) report(document.body, message)
    return condition
}

function matchPoint(element, actual, expected, label = "", threshold = 0.5) {
    if (
        Math.abs(actual[0] - expected[0]) > threshold ||
        Math.abs(actual[1] - expected[1]) > threshold
    ) {
        report(
            element,
            `${label} point [${format(actual)}] doesn't match [${format(
                expected
            )}]`
        )
    }
}

const nextFrame = () =>
    new Promise((resolve) =>
        window.AnimateLayout.frame.postRender(() => resolve())
    )

/**
 * Seek paused animation controls and wait for the frame that renders it.
 */
async function seek(controls, time) {
    controls.time = time
    await nextFrame()
}

/**
 * Mark the test as finished, so the runner can tell a pass from a page
 * whose script never ran.
 */
function done() {
    document.body.dataset.done = "true"
}

function fail(error) {
    report(document.body, String(error && error.stack ? error.stack : error))
    done()
}

window.Quad = {
    report,
    corners,
    centre,
    mix,
    describe,
    rectCorners,
    mixRects,
    matchCorners,
    matchQuad,
    check,
    matchPoint,
    nextFrame,
    seek,
    done,
    fail,
}
