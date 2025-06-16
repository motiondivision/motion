import { expect, Locator, Page, test } from "@playwright/test"

async function eachBox(
    page: Page,
    callback: (box: Locator, index: number) => Promise<void>
) {
    const boxes = page.locator(".box")
    const count = await boxes.count()
    expect(count).toBe(3)
    await callback(boxes.nth(0), 0)
    await callback(boxes.nth(1), 1)
    await callback(boxes.nth(2), 2)
}

async function waitForAnimation(url: string, page: Page, customTimeout = 500) {
    await page.goto(url)
    await page.reload()
    await page.waitForTimeout(customTimeout)
}

test.describe("animate() methods", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test("play", async ({ page }) => {
        await waitForAnimation("animate/animate-play.html", page)
        await eachBox(page, async (box) => {
            const style = await box.getAttribute("style")
            expect(style).toContain("transform: translateX(100px)")
        })
    })

    test("play with repeat: reverse", async ({ page }) => {
        await waitForAnimation("animate/animate-repeat-play.html", page, 600)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(0)
        })
    })

    test("play interrupt", async ({ page }) => {
        await waitForAnimation("animate/animate-interrupt.html", page, 600)

        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).not.toBe("0")
        })
    })

    test("play interrupt custom ease", async ({ page }) => {
        await waitForAnimation(
            "animate/animate-interrupt-custom-ease.html",
            page,
            600
        )
        await eachBox(page, async (box) => {
            expect(box).toHaveText("25")
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(0)
        })
    })

    test("play after finished", async ({ page }) => {
        await waitForAnimation("animate/animate-play-again.html", page)
        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).not.toBe("error")
        })
    })

    test("play after finished and setting time", async ({ page }) => {
        await waitForAnimation("animate/animate-play-again-time.html", page)
        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).not.toBe("error")
        })
    })

    test("play after finished and setting speed", async ({ page }) => {
        await waitForAnimation(
            "animate/animate-play-again-speed.html",
            page,
            600
        )
        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).not.toBeCloseTo(0)
            const text = await box.innerText()
            expect(text).not.toBe("error")
        })
    })

    test("play after setting speed", async ({ page }) => {
        await waitForAnimation("animate/animate-play-negative-speed.html", page)
        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).not.toBe("error")
        })
    })

    test("cancel()", async ({ page }) => {
        await waitForAnimation("animate/animate-cancel.html", page)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(0)
            const text = await box.innerText()
            expect(text).not.toBe("finished")
        })
    })

    test("cancel() interrupt after pause()", async ({ page }) => {
        await waitForAnimation(
            "animate/animate-async-cancel-after-pause.html",
            page
        )
        await eachBox(page, async (box) => {
            // Verify the box is at its middle position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(0)
        })
    })

    test("cancel() interrupt with pause()", async ({ page }) => {
        await waitForAnimation(
            "animate/animate-async-cancel-interrupt.html",
            page
        )
        await eachBox(page, async (box) => {
            // Verify the box is at its middle position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(50)
        })
    })

    test(".finished", async ({ page }) => {
        await waitForAnimation("animate/animate-finished.html", page)

        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).toBe("finished")
        })
    })

    test("subsequent .finished calls should fire immediately", async ({
        page,
    }) => {
        await waitForAnimation("animate/animate-finished-later.html", page)

        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).toBe("finished")
        })
    })

    test("subsequent .finished calls should not fire immediately after replay", async ({
        page,
    }) => {
        await waitForAnimation(
            "animate/animate-finished-after-replay.html",
            page
        )

        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).not.toBe("finished")
        })
    })

    test(".then() backwards compatibility", async ({ page }) => {
        await waitForAnimation("animate/animate-then.html", page)
        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).toBe("finished")
        })
    })

    test("subsequent .then() calls should work immediately", async ({
        page,
    }) => {
        await waitForAnimation("animate/animate-then-later.html", page)

        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).toBe("finished")
        })
    })

    test(".pause()", async ({ page }) => {
        await waitForAnimation("animate/animate-pause.html", page)

        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).toBe("paused")
        })
    })

    test(".pause() before keyframe resolution", async ({ page }) => {
        await waitForAnimation("animate/animate-async-pause.html", page)
        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(0)
            const text = await box.innerText()
            expect(text).toBe("paused")
        })
    })

    test(".pause() before keyframe resolution, after set time", async ({
        page,
    }) => {
        await waitForAnimation(
            "animate/animate-async-pause-after-time.html",
            page
        )
        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).toBe("0.1")
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(50, 1)
        })
    })

    test("hybrid engine", async ({ page }) => {
        await waitForAnimation("animate/animate-pause.html", page)
        await eachBox(page, async (box) => {
            const id = await box.getAttribute("id")

            if (id === "js") {
                // Check if the JS animation has applied a transform style that starts with translateX
                const hasTranslateX = await page.evaluate((boxId) => {
                    const element = document.getElementById(boxId)
                    if (!element) return false
                    const style = element.getAttribute("style") || ""
                    return style.includes("translateX")
                }, id)

                expect(hasTranslateX).toBeTruthy()
            } else if (id === "mini" || id === "waapi") {
                // For mini and waapi, check they have active WAAPI animations
                const hasAnimation = await page.evaluate((boxId) => {
                    const element = document.getElementById(boxId)
                    if (!element) return false
                    return element.getAnimations().length > 0
                }, id)

                expect(hasAnimation).toBeTruthy()
            }
        })
    })

    test("hybrid engine: sync", async ({ page }) => {
        await waitForAnimation("animate/animate-pause.html", page)

        let prevOffset: number | null = null
        let numCompared = 0
        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()

            if (prevOffset && boundingBox) {
                numCompared++
                expect(boundingBox.x / 1000).toBeCloseTo(prevOffset / 1000, 1)
            }

            if (boundingBox) {
                prevOffset = boundingBox?.x
            }
        })

        expect(numCompared).toBe(2)
    })

    test("async time alignment", async ({ page }) => {
        await waitForAnimation("animate/animate-async-time.html", page)

        let prevOffset: number | null = null
        let numCompared = 0
        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()

            if (prevOffset && boundingBox) {
                numCompared++
                expect(boundingBox.x).toBeCloseTo(prevOffset, 1)
            }

            if (boundingBox) {
                prevOffset = boundingBox?.x
            }
        })

        expect(numCompared).toBe(2)
    })

    test("async stop prevents animation", async ({ page }) => {
        await waitForAnimation("animate/animate-async-stop.html", page)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(0)
        })
    })

    test("stop() halts animation midway", async ({ page }) => {
        await waitForAnimation("animate/animate-stop.html", page)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).not.toBe(100)
            // Ensure a style has been applied
            const style = await box.getAttribute("style")
            expect(style).toContain("transform: translateX")
            expect(await box.innerText()).not.toBe("finished")
        })

        const boxes = page.locator(".box")
        const jsBox = boxes.nth(1)
        const waapiBox = boxes.nth(2)
        const jsX = Math.round((await jsBox.boundingBox())?.x || 100)
        const waapiX = Math.round((await waapiBox.boundingBox())?.x || 50)

        expect(Math.abs(jsX - waapiX)).toBeLessThanOrEqual(2)
    })

    test("stop() prevents animation from restarting with play()", async ({
        page,
    }) => {
        await waitForAnimation("animate/animate-stop-restart.html", page)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).not.toBe(100)
            // Ensure a style has been applied
            const style = await box.getAttribute("style")
            expect(style).toContain("transform: translateX")
        })
    })

    test("complete() after cancel()", async ({ page }) => {
        await waitForAnimation("animate/animate-cancel-complete.html", page)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(100)
        })
    })

    test("complete() finishes animation at its end state", async ({ page }) => {
        await waitForAnimation("animate/animate-complete.html", page)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBe(100)
            // Ensure a style has been applied
            const style = await box.getAttribute("style")
            expect(style).toContain("transform: translateX(100px)")
        })
    })

    test("complete() with repeat and reverseType ends on final keyframe", async ({
        page,
    }) => {
        await waitForAnimation("animate/animate-repeat-complete.html", page)
        await eachBox(page, async (box) => {
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBe(0)
            // Ensure a style has been applied
            const style = await box.getAttribute("style")
            expect(style).toContain("transform: ")
        })
    })

    test("complete() with repeat and reverseType ends on final keyframe with mirror", async ({
        page,
    }) => {
        await waitForAnimation(
            "animate/animate-repeat-complete-mirror.html",
            page
        )
        await eachBox(page, async (box, i) => {
            if (i === 0) return // animateMini doesn't support mirror
            // Verify the box is at its original position
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBe(0)
            // Ensure a style has been applied
            const style = await box.getAttribute("style")
            expect(style).toContain("transform: ")
        })
    })

    test("scroll", async ({ page }) => {
        await waitForAnimation("animate/animate-scroll.html", page)

        // Scroll 250px
        await page.evaluate(() => {
            window.scrollTo(0, 250)
        })

        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(50)
        })
    })
})

test.describe("animate() properties", () => {
    test(".time", async ({ page }) => {
        await waitForAnimation("animate/animate-time.html", page)
        await eachBox(page, async (box) => {
            expect(box).toHaveText("paused")
            const boundingBox = await box.boundingBox()
            expect(Math.round(boundingBox!.x)).toBeCloseTo(25)
        })
    })

    test(".speed", async ({ page }) => {
        await waitForAnimation("animate/animate-speed.html", page)
        await eachBox(page, async (box) => {
            expect(box).toHaveText("0.1")
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).not.toBeCloseTo(100)
        })
    })

    test(".speed reversed", async ({ page }) => {
        await waitForAnimation("animate/animate-speed-reverse.html", page)
        await eachBox(page, async (box) => {
            expect(box).toHaveText("finished")
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBe(0)
        })
    })

    test(".duration", async ({ page }) => {
        await waitForAnimation("animate/animate-duration-calc.html", page)

        await eachBox(page, async (box) => {
            const text = await box.innerText()
            expect(text).toBe("0.85")
        })
    })
})

test.describe("animate() options", () => {
    test("repeat", async ({ page }) => {
        await waitForAnimation("animate/animate-repeat.html", page)
        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(25)
        })
    })
    test("repeat reverse", async ({ page }) => {
        await waitForAnimation("animate/animate-repeat-reverse.html", page)
        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(75)
        })
    })

    test("css vars", async ({ page }) => {
        await waitForAnimation("animate/animate-css-vars.html", page)
        await eachBox(page, async (box) => {
            const style = await box.getAttribute("style")
            expect(style).toContain("opacity: var(--opacity-end)")
        })
    })

    test("spring velocity", async ({ page }) => {
        await waitForAnimation("animate/animate-spring-velocity.html", page)
        const box = page.locator(".box")
        const text = await box.innerText()
        expect(text).toBe("pass")
    })
})

test.describe("NativeAnimation", () => {
    test("then", async ({ page }) => {
        await waitForAnimation("animate/animate-wrapper-then.html", page)
        const boxes = page.locator(".box")
        const box = boxes.first()
        const boundingBox = await box.boundingBox()
        expect(boundingBox?.x).toBeCloseTo(0)
        expect(await box.innerText()).toBe("finished")
    })

    test("finished", async ({ page }) => {
        await waitForAnimation("animate/animate-wrapper-finished.html", page)
        const boxes = page.locator(".box")
        const box = boxes.first()
        const boundingBox = await box.boundingBox()
        expect(boundingBox?.x).toBeCloseTo(0)
        expect(await box.innerText()).toBe("finished")
    })
})
