import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { createEffect } from "../utils/create-effect"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

interface Subject {
    isSubject: true
    values: Record<string, unknown>
}

const createSubject = (): Subject => ({ isSubject: true, values: {} })

const subjectEffect = createEffect<Subject>(
    (subject, state, key, value) =>
        state.set(
            key,
            value,
            () => {
                subject.values[key] = state.latest[key]
            },
            undefined,
            false
        ),
    {
        test: (subject): subject is Subject =>
            Boolean((subject as Subject)?.isSubject),
        read: (subject, key) => subject.values[key] as number | undefined,
    }
)

describe("createEffect", () => {
    it("exposes test and read", () => {
        const subject = createSubject()
        subject.values.x = 5

        expect(subjectEffect.test(subject)).toBe(true)
        expect(subjectEffect.test({})).toBe(false)
        expect(subjectEffect.read(subject, "x")).toBe(5)
    })

    it("exposes bound motion values via get", () => {
        const subject = createSubject()
        const x = motionValue(1)

        expect(subjectEffect.get(subject, "x")).toBeUndefined()

        const cancel = subjectEffect(subject, { x })

        expect(subjectEffect.get(subject, "x")).toBe(x)

        cancel()

        expect(subjectEffect.get(subject, "x")).toBeUndefined()
    })

    it("renders in frame.render by default", async () => {
        const subject = createSubject()
        const x = motionValue(1)
        subjectEffect(subject, { x })

        await nextFrame()

        const order: string[] = []
        x.set(2)
        frame.preRender(() => order.push(`pre:${subject.values.x}`))
        frame.render(() => order.push(`render:${subject.values.x}`))

        await nextFrame()

        expect(order).toEqual(["pre:1", "render:2"])
    })

    it("renders in the provided step", async () => {
        const preRenderEffect = createEffect<Subject>(
            (subject, state, key, value) =>
                state.set(
                    key,
                    value,
                    () => {
                        subject.values[key] = state.latest[key]
                    },
                    undefined,
                    false
                ),
            { step: frame.preRender }
        )

        const subject = createSubject()
        const x = motionValue(1)
        preRenderEffect(subject, { x })

        await nextFrame()

        const order: string[] = []
        x.set(2)
        frame.preRender(() => order.push(`pre:${subject.values.x}`))
        frame.render(() => order.push(`render:${subject.values.x}`))

        await nextFrame()

        expect(order).toEqual(["pre:2", "render:2"])
    })
})
