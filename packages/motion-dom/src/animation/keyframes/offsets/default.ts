export function defaultOffset(arr: any[]): number[] {
    const offset = [0]
    const remaining = arr.length - 1

    /**
     * The same offsets as fillOffset(offset, remaining) makes from [0].
     */
    for (let i = 1; i <= remaining; i++) offset.push(i / remaining)

    return offset
}
