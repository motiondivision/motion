import { clamp } from "motion-utils"

const test = (v: any) => typeof v === "number"

export const number = {
    test,
    parse: parseFloat,
    transform: (v: number) => v,
}

export const alpha = {
    test,
    parse: parseFloat,
    transform: (v: number) => clamp(0, 1, v),
}

export const scale = {
    test,
    parse: parseFloat,
    transform: (v: number) => v,
    default: 1,
}
