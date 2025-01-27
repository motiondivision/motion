import { setCSSVar } from "../style"

describe("style", () => {
    test("remove duplicate dash", () => {
        const div = document.createElement("div");
        setCSSVar(div, "--color", "red");

        expect(div.style.getPropertyValue("--color")).toBe("red");
    })
})
