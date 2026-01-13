type Callback = (axis: "x" | "y") => void

export function eachAxis(callback: Callback) {
    return [callback("x"), callback("y")]
}
