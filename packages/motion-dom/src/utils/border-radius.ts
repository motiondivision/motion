/**
 * The four corner-radius longhands. Shared so the projection mixer, scale
 * corrector, WAAPI px-value set and view-transition crop pass don't each carry
 * their own copy. Order is irrelevant - every consumer mixes/corrects/animates
 * each corner independently.
 */
export const cornerRadiusProps = [
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
] as const
