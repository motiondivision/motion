export interface AppearStoreEntry {
    animation: Animation
    startTime: number | null
    /**
     * Generated from initial's transition.out (#1725).
     */
    out?: boolean
}

export type AppearElementId = string

export type IsComplete = boolean

export const appearAnimationStore = new Map<AppearElementId, AppearStoreEntry>()

export const appearComplete = new Map<AppearElementId, IsComplete>()
