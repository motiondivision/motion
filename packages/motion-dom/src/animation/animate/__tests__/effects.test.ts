import { createEffect } from "../../../effects/utils/create-effect"
import { frame } from "../../../frameloop"
import { motionValue } from "../../../value"
import {
    addEffect,
    animateEffectSubject,
    findEffect,
    removeEffect,
} from "../effects"

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

describe("effect registry", () => {
    afterEach(() => removeEffect(subjectEffect))

    it("finds registered effects by test()", () => {
        const subject = createSubject()

        expect(findEffect(subject)).toBeUndefined()

        addEffect(subjectEffect)

        expect(findEffect(subject)).toBe(subjectEffect)
        expect(findEffect({})).toBeUndefined()

        removeEffect(subjectEffect)

        expect(findEffect(subject)).toBeUndefined()
    })

    it("prefers the most recently added effect", () => {
        const laterEffect = createEffect<Subject>(() => () => {}, {
            test: subjectEffect.test,
            read: subjectEffect.read,
        })

        addEffect(subjectEffect)
        addEffect(laterEffect)

        expect(findEffect(createSubject())).toBe(laterEffect)

        removeEffect(laterEffect)

        expect(findEffect(createSubject())).toBe(subjectEffect)
    })

    it("doesn't register the same effect twice", () => {
        addEffect(subjectEffect)
        addEffect(subjectEffect)
        removeEffect(subjectEffect)

        expect(findEffect(createSubject())).toBeUndefined()
    })
})

describe("animateEffectSubject", () => {
    it("reads the initial value from the subject and animates it", async () => {
        const subject = createSubject({ x: 0 })

        const animations = animateEffectSubject(
            subjectEffect,
            subject,
            { x: 100 },
            { duration: 0.1, ease: "linear" }
        )

        expect(animations.length).toBe(1)

        await animations[0].finished
        await nextFrame()

        expect(subject.values.x).toBe(100)
    })

    it("animates from the first keyframe when the subject can't be read", async () => {
        const subject = createSubject()

        const [animation] = animateEffectSubject(
            subjectEffect,
            subject,
            { x: [50, 100] },
            { duration: 0.1 }
        )

        await nextFrame()

        expect(subject.values.x).toBeGreaterThanOrEqual(50)

        await animation.finished
        await nextFrame()

        expect(subject.values.x).toBe(100)
    })

    it("throws when a value can't be read and no from keyframe is provided", () => {
        expect(() =>
            animateEffectSubject(subjectEffect, createSubject(), { x: 100 })
        ).toThrow()
    })

    it("reuses motion values already bound to the subject", async () => {
        const subject = createSubject()
        const x = motionValue(0)
        subjectEffect(subject, { x })

        const [animation] = animateEffectSubject(
            subjectEffect,
            subject,
            { x: 100 },
            { duration: 0.1 }
        )

        await animation.finished

        expect(x.get()).toBe(100)
    })

    it("resolves per-key transitions", async () => {
        const subject = createSubject({ x: 0, y: 0 })

        const animations = animateEffectSubject(
            subjectEffect,
            subject,
            { x: 100, y: 100 },
            { duration: 0.1, y: { duration: 0.2 } }
        )

        expect(animations[0].duration).toBe(0.1)
        expect(animations[1].duration).toBe(0.2)
    })
})
