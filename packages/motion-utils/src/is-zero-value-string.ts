/**
 * Check if the value is a zero value string like "0px" or "0%"
 */
export const isZeroValueString = (v: string) => /^0[^.\s]+$/u.test(v)
