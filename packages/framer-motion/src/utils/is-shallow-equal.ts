/**
 * Whether two plain objects or arrays hold the same values. With `depth`,
 * the values (except children) are compared that many levels deeper.
 * Anything else, like a class instance, is only equal to itself.
 */
export function isShallowEqual(a: any, b: any, depth = 0): boolean {
    if (a === b) return true
    const type = a?.constructor
    if (!b || type !== b.constructor || (type !== Object && type !== Array)) {
        return false
    }
    let numKeys = 0
    for (const key in b) {
        numKeys++
        if (
            depth && key !== "children"
                ? !isShallowEqual(a[key], b[key], depth - 1)
                : a[key] !== b[key]
        ) {
            return false
        }
    }
    for (const _ in a) numKeys--
    return !numKeys
}
