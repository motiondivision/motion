declare interface Document extends DocumentViewTransition {}

declare interface DocumentViewTransition {
    /** @see https://drafts.csswg.org/css-view-transitions/#additions-to-document-api */
    startViewTransition?(updateCallback?: UpdateCallback): ViewTransition
}

/** @see https://drafts.csswg.org/css-view-transitions/#viewtransition */
interface ViewTransition {
    readonly updateCallbackDone: Promise<void>
    readonly ready: Promise<void>
    readonly finished: Promise<void>

    skipTransition(): void
}

declare interface CSSStyleDeclaration {
    viewTransitionName: string
}

declare interface AnimationEffect {
    target: Element
    pseudoElement?: string
    getKeyframes(): Keyframe[]
}

type UpdateCallback = () => Promise<void>
