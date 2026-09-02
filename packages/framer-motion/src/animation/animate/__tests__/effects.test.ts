import { createEffect, frame, motionValue } from "motion-dom"
import { animate } from ".."

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

interface Subject {
    isSubject: true
    values: Record<string, number | string>
}

const createSubject = (values: Subject["values"] = {}): Subject => ({
    isSubject: true,
    values,
})

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
        read: (subject, key) => subject.values[key],
    }
)

describe("animate.addEffect", () => {
    beforeEach(() => animate.addEffect(subjectEffect))
    afterEach(() => animate.removeEffect(subjectEffect))

    test("animates subjects claimed by a registered effect", async () => {
        const subject = createSubject({ x: 0 })

        await animate(subject, { x: 100 }, { duration: 0.01 })
        await nextFrame()

        expect(subject.values.x).toBe(100)
    })

    test("falls back to plain objects when no effect claims the subject", async () => {
        const subject = { x: 0 }

        await animate(subject, { x: 100 }, { duration: 0.01 })

        expect(subject.x).toBe(100)
    })

    test("animates DOM elements even when an effect claims everything", async () => {
        const greedyEffect = createEffect<any>(() => () => {}, {
            test: (_subject: unknown): _subject is any => true,
            read: () => 0,
        })
        animate.addEffect(greedyEffect)

        const element = document.createElement("div")
        await animate(element, { opacity: 0.5 }, { duration: 0.01 })
        await nextFrame()

        animate.removeEffect(greedyEffect)

        expect(element.style.opacity).toBe("0.5")
    })

    test("animates arrays of effect subjects with stagger", async () => {
        const a = createSubject({ x: 0 })
        const b = createSubject({ x: 0 })

        await animate(
            [a, b],
            { x: 100 },
            {
                duration: 0.01,
                delay: (i: number) => i * 0.01,
            }
        )
        await nextFrame()

        expect(a.values.x).toBe(100)
        expect(b.values.x).toBe(100)
    })

    test("animates mixed DOM and effect subjects in a sequence", async () => {
        const element = document.createElement("div")
        const subject = createSubject({ x: 0 })

        await animate(
            [
                [element, { opacity: 0.5 }, { duration: 0.01 }],
                [subject, { x: 100 }, { duration: 0.01 }],
            ],
            { duration: 0.01 }
        )
        await nextFrame()

        expect(element.style.opacity).toBe("0.5")
        expect(subject.values.x).toBe(100)
    })

    test("reuses motion values bound via the effect", async () => {
        const subject = createSubject()
        const x = motionValue(0)
        subjectEffect(subject, { x })

        await animate(subject, { x: 100 }, { duration: 0.01 })

        expect(x.get()).toBe(100)
    })
})
