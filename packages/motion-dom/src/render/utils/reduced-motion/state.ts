interface ReducedMotionState {
    current: boolean | null
}

// Does this device prefer reduced motion? Returns `null` server-side.
export const prefersReducedMotion: ReducedMotionState = { current: null }

export const hasReducedMotionListener = { current: false }
