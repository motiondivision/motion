export function eachAxis<T>(callback: (axis: "x" | "y") => T): T[] {
    return [callback("x"), callback("y")]
}
