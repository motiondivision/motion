export const clamp = (min: number, max: number, v: number) => {
    if (v > max) return max
    if (v < min) return min
    return v
}
