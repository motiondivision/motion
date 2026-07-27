export function getViewAnimations() {
    return document.getAnimations().filter((animation) => {
        const { effect } = animation
        return (
            !!effect &&
            effect.target === document.documentElement &&
            (effect as KeyframeEffect).pseudoElement?.startsWith(
                "::view-transition"
            )
        )
    })
}
