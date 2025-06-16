import { number } from "./numbers"

export const int = {
    ...number,
    transform: Math.round,
}
