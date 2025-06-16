export function mixImmediate<T>(a: T, b: T) {
    return (p: number) => (p > 0 ? b : a)
}
