/**
 * The opacity rendered in place of 0 on the server and at the first mount:
 * low enough to look hidden, high enough for the browser to count the
 * content as painted. Browsers don't count content at opacity 0 as
 * painted, and an opacity animation that runs on the compositor never
 * repaints it on the main thread, so first contentful paint and largest
 * contentful paint would only be recorded once the animation ends.
 */
export const mountOpacity = 0.001
