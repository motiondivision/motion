const warned = new Set<string>()

export function hasWarned(message: string) {
    return warned.has(message)
}

export function warnOnce(
    condition: boolean,
    message: string,
    element?: Element
) {
    if (condition || warned.has(message)) return

    console.warn(message)
    if (element) console.warn(element)
    warned.add(message)
}
