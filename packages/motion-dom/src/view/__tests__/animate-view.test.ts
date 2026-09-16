import { animateView } from "../animate-view"
import { NativeAnimation } from "../../animation/NativeAnimation"
import { getViewAnimations } from "../utils/get-view-animations"

jest.mock("../utils/get-view-animations", () => ({
    getViewAnimations: jest.fn(),
}))
jest.mock("../../animation/NativeAnimation", () => ({
    NativeAnimation: jest.fn(),
}))
jest.mock("../../animation/NativeAnimationWrapper", () => ({
    NativeAnimationWrapper: jest.fn((animation) => animation),
}))

class ViewEffect {
    updateTiming = jest.fn()
    constructor(public pseudoElement: string) {}
}

const getAnimations = getViewAnimations as jest.Mock
const createAnimation = NativeAnimation as unknown as jest.Mock
const originalKeyframeEffect = global.KeyframeEffect

beforeAll(() => {
    global.KeyframeEffect = ViewEffect as unknown as typeof KeyframeEffect
})
afterAll(() => {
    global.KeyframeEffect = originalKeyframeEffect
})
beforeEach(() => {
    jest.clearAllMocks()
})

it("creates custom keyframes once even when several browser layers match", () => {
    const [group, ...layers] = ["group", "old", "new"].map((layer) => ({
        effect: new ViewEffect(`::view-transition-${layer}(test)`),
        cancel: jest.fn(),
    }))
    const unrelated = {
        effect: new ViewEffect("::view-transition-new(other)"),
        cancel: jest.fn(),
    }
    getAnimations.mockReturnValue([group, ...layers, unrelated])
    const cancel = jest.fn()
    createAnimation.mockImplementation(() => ({ cancel }))
    const resolve = jest.fn(() => ({ opacity: 1 }))
    const cleanup = animateView("test", "enter", { enter: resolve }, ["next"])

    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith(["next"])
    expect(createAnimation).toHaveBeenCalledTimes(1)
    expect(createAnimation).toHaveBeenCalledWith(
        expect.objectContaining({
            name: "opacity",
            keyframes: [0, 1],
            pseudoElement: "::view-transition-new(test)",
        })
    )
    layers.forEach((layer) => expect(layer.cancel).toHaveBeenCalledTimes(1))
    expect(group.cancel).not.toHaveBeenCalled()
    expect(unrelated.cancel).not.toHaveBeenCalled()
    cleanup()
    expect(cancel).toHaveBeenCalledTimes(1)
})

it("keeps the group morph running when custom values replace the crossfade", () => {
    const group = {
        effect: new ViewEffect("::view-transition-group(test)"),
        cancel: jest.fn(),
    }
    const { updateTiming } = group.effect
    const old = {
        effect: new ViewEffect("::view-transition-old(test)"),
        cancel: jest.fn(),
    }
    getAnimations.mockReturnValue([group, old])
    createAnimation.mockImplementation(() => ({ cancel: jest.fn() }))

    animateView(
        "test",
        "share",
        { share: { clipPath: ["inset(0)", "inset(10%)"] } },
        []
    )

    expect(old.cancel).toHaveBeenCalledTimes(1)
    expect(group.cancel).not.toHaveBeenCalled()
    expect(updateTiming).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 300 })
    )
    expect(createAnimation).toHaveBeenCalledTimes(1)
    expect(createAnimation).toHaveBeenCalledWith(
        expect.objectContaining({
            name: "clipPath",
            pseudoElement: "::view-transition-old(test)",
        })
    )
})

it("does not report completion after React cleans up an interrupted transition", async () => {
    getAnimations.mockReturnValue([
        {
            effect: new ViewEffect("::view-transition-old(test)"),
            cancel: jest.fn(),
        },
    ])
    let finish: VoidFunction = () => {}
    const finished = new Promise<void>((resolve) => {
        finish = resolve
    })
    const cancel = jest.fn()
    createAnimation.mockImplementation(() => ({ finished, cancel }))
    const onAnimationComplete = jest.fn()
    const cleanup = animateView(
        "test",
        "exit",
        {
            exit: { opacity: 0 },
            onAnimationComplete,
        },
        []
    )

    cleanup()
    finish()
    await finished
    await Promise.resolve()
    expect(onAnimationComplete).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledTimes(1)
})
