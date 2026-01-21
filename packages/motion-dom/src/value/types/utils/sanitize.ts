// If this number is a decimal, make it just five decimal places
// to avoid exponents. Handle NaN edge cases from spring animations (issue #2791).
export const sanitize = (v: number) =>
    Number.isNaN(v) ? 0 : Math.round(v * 100000) / 100000
