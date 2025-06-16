function filterViewAnimations(animation: Animation) {
    const { effect } = animation
    if (!effect) return false

    return (
        effect.target === document.documentElement &&
        effect.pseudoElement?.startsWith("::view-transition")
    )
}

export function getViewAnimations() {
    return document.getAnimations().filter(filterViewAnimations)
}
