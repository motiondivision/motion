export function calculateRepeatDuration(
    duration: number,
    repeat: number,
    _repeatDelay: number
): number {
    return duration * (repeat + 1)
}
