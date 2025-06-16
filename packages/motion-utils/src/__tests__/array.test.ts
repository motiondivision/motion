import { addUniqueItem, removeItem } from "../array"

describe("addUniqueItem", () => {
    test("Only adds a new item if it isn't already in the array", () => {
        const array = [0, 1, 2, 3]
        addUniqueItem(array, 4)
        expect(array).toEqual([0, 1, 2, 3, 4])
        addUniqueItem(array, 3)
        expect(array).toEqual([0, 1, 2, 3, 4])
    })
})

describe("removeItem", () => {
    test("Fires the callback once for each axis and returns an array with the results", () => {
        const array = [0, 1, 2, 3]
        removeItem(array, 2)
        expect(array).toEqual([0, 1, 3])
        removeItem(array, 4)
        expect(array).toEqual([0, 1, 3])
    })
})
