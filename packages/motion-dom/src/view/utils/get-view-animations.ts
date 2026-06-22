export function getViewAnimations(root: Element = document.documentElement) {
    return document.getAnimations().filter((animation) => {
        const { effect } = animation
        return (
            !!effect &&
            effect.target === root &&
            (effect as KeyframeEffect).pseudoElement?.startsWith(
                "::view-transition"
            )
        )
    })
}
