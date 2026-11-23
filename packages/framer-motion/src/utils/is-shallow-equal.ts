/**
 * Whether two plain objects or arrays hold the same values. Anything
 * else, like a class instance, is only equal to itself.
 */
export function isShallowEqual(a: any, b: any): boolean {
    if (a === b) return true
    const type = a?.constructor
    if (!b || type !== b.constructor || (type !== Object && type !== Array)) {
        return false
    }
    let numKeys = 0
    for (const key in b) {
        numKeys++
        if (a[key] !== b[key]) return false
    }
    for (const _ in a) numKeys--
    return !numKeys
}
