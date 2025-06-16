import { clamp } from "motion-utils"

export const number = {
    test: (v: number) => typeof v === "number",
    parse: parseFloat,
    transform: (v: number) => v,
}

export const alpha = {
    ...number,
    transform: (v: number) => clamp(0, 1, v),
}

export const scale = {
    ...number,
    default: 1,
}
