import { useEffect } from "react"
import { frame } from "../../"
import { render } from "../../jest.setup"
import { useMotionValue } from "../use-motion-value"
import { useTransform } from "../use-transform"

async function nextFrame() {
    return new Promise<void>((resolve) => frame.postRender(() => resolve()))
}

test("#2280 combined useTransform reflects chained transform updates", async () => {
    let result: any, quarter: any
    const Component = ({ onReady }: { onReady: (a: any) => void }) => {
        const a = useMotionValue(0)
        const aHalf = useTransform(a, (v: number) => v / 2)
        const aQuarter = useTransform(aHalf, (h: number) => h / 2)
        const r = useTransform(
            [a, aQuarter],
            ([av, q]: number[]) => av + q
        )
        result = r
        quarter = aQuarter
        useEffect(() => { onReady(a) }, [])
        return null
    }
    let a: any
    render(<Component onReady={(v) => (a = v)} />)
    await nextFrame()
    a.set(100)
    for (let i = 0; i < 5; i++) await nextFrame()
    expect(quarter.get()).toBe(25)
    expect(result.get()).toBe(125)
})
