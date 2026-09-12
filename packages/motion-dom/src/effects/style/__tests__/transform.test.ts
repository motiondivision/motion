import { MotionValueState } from "../../MotionValueState"
import { buildTransform } from "../transform"
function build(latest: MotionValueState["latest"]) {
    const state = new MotionValueState()
    state.latest = latest
    state.transformKeys = Object.keys(latest).filter(
        (key) => key !== "pathRotation"
    )
    return buildTransform(state)
}
test("compacts translation-only states, preserving units and identity", () => {
    expect(build({ x: 10, y: 20 })).toBe("translate(10px, 20px)")
    expect(build({ x: "50%", y: "2em" })).toBe("translate(50%, 2em)")
    expect(build({ y: -20 })).toBe("translate(0px, -20px)")
    expect(build({ x: 0, y: "0px" })).toBe("none")
})
test("mixed transforms and path rotation preserve existing order", () => {
    expect(build({ x: 10, rotate: 30 })).toBe("translateX(10px) rotate(30deg)")
    expect(build({ x: 10, pathRotation: 30 })).toBe(
        "translateX(10px) rotate(30deg)"
    )
    expect(build({ x: 10, z: 20 })).toBe("translateX(10px) translateZ(20px)")
})
