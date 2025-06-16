import type { EventInfo } from "motion-dom"
import type { RefObject } from "react"

export type EventHandler = (event: PointerEvent, info: EventInfo) => void

export type ListenerControls = [() => void, () => void]

export type TargetOrRef = EventTarget | RefObject<EventTarget>

export type TargetBasedReturnType<Target> = Target extends EventTarget
    ? ListenerControls
    : undefined
