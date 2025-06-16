import { memo } from "../memo"

describe("memo", () => {
    test("Only fires callback once", () => {
        const callback = jest.fn()

        const test = () => {
            callback()
            return 0
        }

        const memoized = memo(test)

        expect(memoized()).toEqual(0)
        expect(memoized()).toEqual(0)
        expect(callback).toBeCalledTimes(1)
    })
})
