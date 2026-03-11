import type { MotionValue } from "../index"

export interface WillChange extends MotionValue<string> {
    add(name: string): void
}
