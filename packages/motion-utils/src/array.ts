export function addUniqueItem<T>(arr: T[], item: T) {
    if (arr.indexOf(item) === -1) arr.push(item)
}

export function removeItem<T>(arr: T[], item: T) {
    const index = arr.indexOf(item)
    if (index > -1) arr.splice(index, 1)
}

// Adapted from array-move
export function moveItem<T>([...arr]: T[], fromIndex: number, toIndex: number) {
    const startIndex = fromIndex < 0 ? arr.length + fromIndex : fromIndex

    if (startIndex >= 0 && startIndex < arr.length) {
        const endIndex = toIndex < 0 ? arr.length + toIndex : toIndex

        const [item] = arr.splice(fromIndex, 1)
        arr.splice(endIndex, 0, item)
    }

    return arr
}
