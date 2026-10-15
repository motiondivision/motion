import { Page } from "@playwright/test"

/**
 * Shared helpers for the vanilla drag() Playwright specs. The pages live in
 * dev/html/public/playwright/gestures/drag-*.html and use the real browser
 * pointer pipeline via page.mouse, so hit testing, pointer capture and
 * coalescing all match what a user would get.
 */

export interface Rect {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
}

/**
 * Wait for `count` animation frames in the page. PanSession applies each
 * pointermove on the next frame, so a frame between moves makes the gesture
 * deterministic.
 */
export function frames(page: Page, count = 2) {
    return page.evaluate(
        (n) =>
            new Promise<void>((resolve) => {
                const tick = (i: number) =>
                    i <= 0
                        ? resolve()
                        : requestAnimationFrame(() => tick(i - 1))
                tick(n)
            }),
        count
    )
}

export function rect(page: Page, selector: string): Promise<Rect> {
    return page.locator(selector).evaluate((el) => {
        const { left, top, right, bottom, width, height } =
            el.getBoundingClientRect()
        const r = (v: number) => Math.round(v * 100) / 100
        return {
            left: r(left),
            top: r(top),
            right: r(right),
            bottom: r(bottom),
            width: r(width),
            height: r(height),
        }
    })
}

export async function center(page: Page, selector: string) {
    const box = (await page.locator(selector).boundingBox())!
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * Press at a point, cross the drag threshold, then move to `to` and wait
 * a frame so the move is applied. Leaves the pointer down.
 */
export async function pressAndMove(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
    { steps = 5 }: { steps?: number } = {}
) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await frames(page, 1)

    // Cross the 3px threshold towards the target, so direction lock sees
    // the intended axis first
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy) || 1
    await page.mouse.move(from.x + (dx / len) * 6, from.y + (dy / len) * 6)
    await frames(page, 1)

    await page.mouse.move(to.x, to.y, { steps })
    await frames(page, 1)
}

/**
 * A full drag gesture from `from` to `to`, released without momentum
 * (a frame passes between the last move and release).
 */
export async function dragFromTo(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
    options?: { steps?: number }
) {
    await pressAndMove(page, from, to, options)
    await page.mouse.up()
    await frames(page, 2)
}

/**
 * Drag the element under `selector` by a delta, starting from an offset
 * inside the element (defaults to its centre).
 */
export async function dragBy(
    page: Page,
    selector: string,
    dx: number,
    dy: number,
    offset?: { x: number; y: number }
) {
    const box = (await page.locator(selector).boundingBox())!
    const from = offset
        ? { x: box.x + offset.x, y: box.y + offset.y }
        : { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await dragFromTo(page, from, { x: from.x + dx, y: from.y + dy })
}

/**
 * The element's translate, read from its computed transform matrix.
 */
export function translate(page: Page, selector: string) {
    return page.locator(selector).evaluate((el) => {
        const { m41, m42 } = new DOMMatrix(getComputedStyle(el).transform)
        return {
            x: Math.round(m41 * 100) / 100,
            y: Math.round(m42 * 100) / 100,
        }
    })
}

export function events(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).events)
}

/**
 * Dispatch a synthetic pointer event on an element at viewport
 * coordinates. Used where page.mouse can't reach (an element outside the
 * viewport) or several events must land in the same frame.
 */
export function dispatchPointer(
    page: Page,
    selector: string,
    type: string,
    clientX: number,
    clientY: number
) {
    return page.locator(selector).evaluate(
        (el, [type, clientX, clientY]) => {
            el.dispatchEvent(
                new PointerEvent(type as string, {
                    clientX: clientX as number,
                    clientY: clientY as number,
                    pointerId: 1,
                    pointerType: "mouse",
                    isPrimary: true,
                    button: 0,
                    bubbles: true,
                    cancelable: true,
                })
            )
        },
        [type, clientX, clientY] as const
    )
}
