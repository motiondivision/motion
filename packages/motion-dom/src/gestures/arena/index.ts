/**
 * One state machine that every Motion gesture reports to, whether it's
 * started by press(), hover(), drag() or a React gesture prop.
 *
 * - Pointer gestures (press, drag, pan, ...) join the arena of the pointer
 *   that started them, as "possible". The first to claim the pointer becomes
 *   "active", and every other member it can't run alongside is cancelled.
 * - Gestures that don't compete for a pointer (hover) only join the
 *   registry, so other gestures and app code can read them.
 */
export type GestureKind = "press" | "drag" | "hover" | (string & {})

export type GesturePhase = "possible" | "active" | "ended"

export interface Gesture {
    kind: GestureKind
    element: Element
    pointerId?: number

    /**
     * For a gesture that uses several pointers, like a pinch, every
     * pointer it uses. It joins the arena of each one.
     */
    pointers?: number[]
    phase: GesturePhase

    /**
     * A passive gesture, like hover, doesn't compete for its pointer.
     * It's only in the registry.
     */
    passive?: boolean

    /**
     * The gesture that claimed this gesture's pointer, if another did.
     * A gesture that stays alongside it (see `with`) can use this to end
     * without success, as a press does after its element is dragged.
     */
    claimedBy?: Gesture

    /**
     * Called when another gesture claims this gesture's pointer and the two
     * can't run together. The gesture should end without success.
     */
    cancel?: (by: Gesture) => void

    /**
     * Whether this gesture can stay possible or active while `other`
     * is active on the same pointer.
     */
    with?: (other: Gesture) => boolean
}

export type GestureListener = (gesture: Gesture) => void

const registry = new Set<Gesture>()
const listeners = new Set<GestureListener>()

const pointersOf = (g: Gesture) => g.pointers || [g.pointerId]

const sharesPointer = (a: Gesture, b: Gesture) =>
    pointersOf(a).some((id) => pointersOf(b).includes(id))

const notify = (gesture: Gesture) => listeners.forEach((l) => l(gesture))

/**
 * Add a gesture to the registry. Unless it's passive, it also joins the
 * arena of its pointer: the other non-passive gestures with that pointer.
 */
export function joinGesture(
    gesture: Omit<Gesture, "phase"> & { phase?: GesturePhase }
): Gesture {
    const g = gesture as Gesture
    g.phase ||= "possible"
    registry.add(g)
    notify(g)
    return g
}

/**
 * Try to make a gesture active. Fails if it has left, or an active gesture on the same
 * pointer can't run alongside it. Otherwise every other member of the
 * arena that can't run alongside it is cancelled.
 */
export function claimGesture(gesture: Gesture): boolean {
    // A gesture that was cancelled or has ended can't claim
    if (!registry.has(gesture)) return false

    const arena: Gesture[] = []
    const rivals: Gesture[] = []

    for (const other of registry) {
        if (
            other === gesture ||
            other.passive ||
            !sharesPointer(other, gesture)
        )
            continue
        arena.push(other)
        if (other.with?.(gesture) || gesture.with?.(other)) continue
        if (other.phase === "active") return false
        rivals.push(other)
    }

    arena.forEach((other) => (other.claimedBy = gesture))
    gesture.phase = "active"
    notify(gesture)

    rivals.forEach((rival) => {
        rival.cancel?.(gesture)
        leaveGesture(rival)
    })

    return true
}

/**
 * Remove a gesture from the registry and its pointer's arena.
 */
export function leaveGesture(gesture: Gesture) {
    if (registry.delete(gesture)) {
        gesture.phase = "ended"
        notify(gesture)
    }
}

/**
 * Gestures that are possible or active, optionally filtered by
 * kind and element.
 */
export const getGestures = (kind?: GestureKind, element?: Element) =>
    [...registry].filter(
        (g) => (!kind || g.kind === kind) && (!element || g.element === element)
    )

/**
 * Whether a gesture is active, optionally of a kind and on an element.
 */
export const isGestureActive = (kind?: GestureKind, element?: Element) =>
    getGestures(kind, element).some((g) => g.phase === "active")

/**
 * Subscribe to every gesture phase change. Returns an unsubscribe function.
 */
export function onGestureChange(listener: GestureListener): VoidFunction {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
