export function convertOffsetToTimes(offset: number[], duration: number) {
    return offset.map((o) => o * duration)
}
