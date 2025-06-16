import { transform } from "../transform"

// Functionality of `transform` is thoroughly tested in `interpolate`
// but here we test the overload functionality and some basic interpolations/typings
describe("transform", () => {
    test("works identically with both syntax", () => {
        expect(transform([0, 1], [0, 100], { clamp: false })(-0.5)).toEqual(
            transform(-0.5, [0, 1], [0, 100], { clamp: false })
        )
    })

    test("works with numbers", () => {
        expect(transform([0, 1], [0, 100])(0.5)).toEqual(50)
    })

    test("works with colors", () => {
        expect(transform([0, 1], ["#fff", "#000"])(0.5)).toEqual(
            "rgba(180, 180, 180, 1)"
        )
    })

    test("works with complex strings", () => {
        expect(
            transform([0, 1], ["0 #fff solid", "20px #000 solid"])(0.5)
        ).toEqual("10px rgba(180, 180, 180, 1) solid")
    })

    test("works with objects", () => {
        expect(
            transform(
                [0, 1],
                [
                    { opacity: 1, backgroundColor: "#fff" },
                    { opacity: 2, backgroundColor: "#000" },
                ]
            )(0.5)
        ).toEqual({ opacity: 1.5, backgroundColor: "rgba(180, 180, 180, 1)" })
    })

    test("works with arrays", () => {
        expect(
            transform(
                [0, 1],
                [
                    [1, "#fff"],
                    [2, "#000"],
                ]
            )(0.5)
        ).toEqual([1.5, "rgba(180, 180, 180, 1)"])
    })
})
