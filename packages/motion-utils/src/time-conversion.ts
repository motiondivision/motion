/**
 * Converts seconds to milliseconds
 *
 * @param seconds - Time in seconds.
 * @return milliseconds - Converted time in milliseconds.
 */

/*#__NO_SIDE_EFFECTS__*/
export const secondsToMilliseconds = (seconds: number) => seconds * 1000

/*#__NO_SIDE_EFFECTS__*/
export const millisecondsToSeconds = (milliseconds: number) =>
    milliseconds / 1000
