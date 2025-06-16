import { backIn } from "./back"

export const anticipate = (p: number) =>
    (p *= 2) < 1 ? 0.5 * backIn(p) : 0.5 * (2 - Math.pow(2, -10 * (p - 1)))
