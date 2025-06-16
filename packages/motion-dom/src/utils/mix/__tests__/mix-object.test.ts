import { mixObject } from "../complex"

test("mixObject", () => {
    expect(
        mixObject(
            {
                x: 0,
                y: "0px",
                color: "#fff",
                shadow: "#000 0px 20px 0px",
            },
            {
                x: 100,
                y: "100px",
                color: "#000",
                shadow: "0px 10px #fff",
            }
        )(0.5)
    ).toEqual({
        x: 50,
        y: "50px",
        color: "rgba(180, 180, 180, 1)",
        shadow: "0px 15px rgba(180, 180, 180, 1)",
    })
})
