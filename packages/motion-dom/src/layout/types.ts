import type { AnimationOptions, DOMKeyframesDefinition } from "../animation/types"
import type { ElementOrSelector } from "../utils/resolve-elements"

export type { AnimationOptions, DOMKeyframesDefinition, ElementOrSelector }

export interface RemovedElement {
    element: HTMLElement
    parentElement: HTMLElement
    nextSibling: Node | null
}

export interface MutationResult {
    entering: HTMLElement[]
    exiting: RemovedElement[]
    persisting: HTMLElement[]
    sharedEntering: Map<string, HTMLElement>
    sharedExiting: Map<string, HTMLElement>
}
