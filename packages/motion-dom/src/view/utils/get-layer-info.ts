export function getViewAnimationLayerInfo(pseudoElement: string) {
    const match = pseudoElement.match(
        // `group-children` (nested transitions) before `group` so it wins.
        /::view-transition-(old|new|group-children|group|image-pair)\((.*?)\)/
    )
    if (!match) return null

    return { layer: match[2], type: match[1] }
}
