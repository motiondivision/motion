/**
 * Whether two plain objects or arrays hold the same values, by `isEqual`.
 * Anything else, like a motion value or a class instance, is only equal
 * to itself.
 */
export function isShallowEqual(
    a: any,
    b: any,
    isEqual: (a: any, b: any) => boolean = (x, y) => x === y
): boolean {
    if (a === b) return true
    const type = a?.constructor
    if (!b || type !== b.constructor || (type !== Object && type !== Array)) {
        return false
    }
    let numKeys = 0
    for (const key in b) {
        numKeys++
        if (!isEqual(a[key], b[key])) return false
    }
    for (const _ in a) numKeys--
    return !numKeys
}
