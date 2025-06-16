import type { MotionValue } from "motion-dom"

export interface WillChange extends MotionValue<string> {
    add(name: string): void
}
