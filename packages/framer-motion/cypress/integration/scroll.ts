describe("scroll() callbacks", () => {
    it("Fires callback on first frame, before scroll event", () => {
        cy.visit("?test=scroll-callback-first-frame")
            .wait(100)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("2")
            })
    })

    it("Correctly updates window scroll progress callback", () => {
        cy.visit("?test=scroll-container").wait(100)

        cy.get("#container")
            .scrollTo(0, 50)
            .get("#label")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.5")
            })
    })

    it("Correctly measures scroll position", () => {
        cy.visit("?test=scroll-callback-window").wait(100).viewport(100, 400)

        cy.scrollTo(0, 600)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.5")
            })
        cy.viewport(100, 800)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.25")
            })

        cy.get("#error").should(([$element]: any) => {
            expect($element.innerText).to.equal("")
        })
    })

    it("Correctly updates window scroll progress callback, x axis", () => {
        cy.visit("?test=scroll-callback-window-x").wait(100).viewport(400, 100)

        cy.scrollTo(600, 0)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.5")
            })
        cy.viewport(800, 100)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.25")
            })
    })

    it("Correctly updates element scroll progress callback", () => {
        cy.visit("?test=scroll-callback-element").wait(100)

        cy.get("#scroller")
            .scrollTo(0, 600)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                const progress = parseFloat($element.innerText)
                const isClose = progress >= 0.49 && progress <= 0.51
                expect(isClose).to.equal(true)
            })
    })

    it("Correctly updates element scroll progress callback, x axis", () => {
        cy.visit("?test=scroll-callback-element-x").wait(100)

        cy.get("#scroller")
            .scrollTo(600, 0)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                const progress = parseFloat($element.innerText)
                const isClose = progress >= 0.49 && progress <= 0.51
                expect(isClose).to.equal(true)
            })
    })
})

describe("scroll() animation", () => {
    it("Updates animation on first frame, before scroll event", () => {
        cy.visit("?test=scroll-animate-window")
            .wait(100)
            .get("#color")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(255, 255, 255)"
                )
            })
    })

    it("Correctly updates window scroll progress callback", () => {
        cy.visit("?test=scroll-animate-window").wait(100).viewport(100, 400)

        cy.scrollTo(0, 600)
            .wait(200)
            .get("#color")
            .should(([$element]: any) => {
                // This is animated by animate and thus uses linear RGB mixing
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(180, 180, 180)"
                )

                // This is animated by animate mini and thus doesn't use linear RGB mixing
                expect(getComputedStyle($element).color).to.equal(
                    "rgb(128, 128, 128)"
                )

                expect(getComputedStyle($element).opacity).to.equal("0.5")
                expect($element.style.transform).to.equal("translateX(50px)")

                expect($element.innerText).to.equal("50")
            })
        cy.viewport(100, 800)
            .wait(200)
            .get("#color")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(221, 221, 221)"
                )
                expect(getComputedStyle($element).color).to.equal(
                    "rgb(64, 64, 64)"
                )
            })
    })
    it("With useAnimateMini, updates animation on first frame, before scroll event", () => {
        cy.visit("?test=scroll-animate-style")
            .wait(100)
            .get("#color")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(255, 255, 255)"
                )
            })
    })

    it("Correctly applies the same easing to both useAnimate and useAnimateMini", () => {
        cy.visit("?test=scroll-default-ease").wait(100).viewport(400, 400)

        // Scroll halfway down the page
        cy.scrollTo(0, 1250)
            .wait(200)
            // Get all the elements we need to compare
            .get("div")
            .contains("mini - default")
            .as("miniDefault")
            .get("div")
            .contains("animate - default")
            .as("animateDefault")
            .get("div")
            .contains("mini - easeOut")
            .as("miniEaseOut")
            .get("div")
            .contains("animate - easeOut")
            .as("animateEaseOut")
            .get("div")
            .contains("mini - spring")
            .as("miniSpring")
            .get("div")
            .contains("animate - spring")
            .as("animateSpring")
            .get("div")
            .contains("animate main thread - default")
            .as("animateMainThreadDefault")
            .get("div")
            .contains("animate main thread - easeOut")
            .as("animateMainThreadEaseOut")
            .get("div")
            .contains("animate main thread - spring")
            .as("animateMainThreadSpring")
            // Now compare transforms
            .then(function () {
                const miniDefaultBounds =
                    this.miniDefault[0].getBoundingClientRect()
                const animateDefaultBounds =
                    this.animateDefault[0].getBoundingClientRect()
                const miniEaseOutBounds =
                    this.miniEaseOut[0].getBoundingClientRect()
                const animateEaseOutBounds =
                    this.animateEaseOut[0].getBoundingClientRect()
                const miniSpringBounds =
                    this.miniSpring[0].getBoundingClientRect()
                const animateMainThreadDefaultBounds =
                    this.animateMainThreadDefault[0].getBoundingClientRect()
                const animateMainThreadEaseOutBounds =
                    this.animateMainThreadEaseOut[0].getBoundingClientRect()
                const animateMainThreadSpringBounds =
                    this.animateMainThreadSpring[0].getBoundingClientRect()

                // Both default boxes should have the same position
                expect(miniDefaultBounds.left).to.equal(
                    animateDefaultBounds.left
                )

                // Both easeOut boxes should have the same position
                expect(miniEaseOutBounds.left).to.equal(
                    animateEaseOutBounds.left
                )

                expect(animateMainThreadDefaultBounds.left).to.equal(
                    animateDefaultBounds.left
                )
                expect(
                    Math.round(animateMainThreadEaseOutBounds.left)
                ).to.equal(Math.round(animateEaseOutBounds.left))

                // Skipping as env doesn't support linear() easing
                // expect(miniSpringBounds.left).to.equal(animateSpringBounds.left)

                // Each easing type should have different positions
                expect(miniDefaultBounds.left).not.to.equal(
                    miniEaseOutBounds.left
                )
                expect(miniDefaultBounds.left).not.to.equal(
                    miniSpringBounds.left
                )
                expect(animateMainThreadDefaultBounds.left).not.to.equal(
                    animateMainThreadEaseOutBounds.left
                )
                expect(animateMainThreadDefaultBounds.left).not.to.equal(
                    animateMainThreadSpringBounds.left
                )
                // Skipping as env doesn't support linear() easing
                // expect(miniEaseOutBounds.left).not.to.equal(
                //     miniSpringBounds.left
                // )
            })
    })

    it("correctly applies parallax animations", () => {
        cy.visit("?test=scroll-parallax")
            .viewport(1000, 500)
            .wait(200)
            .get(".img-container:first-child .main-thread.sentinel")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().top).to.equal(200)
            })
            .get(".img-container:first-child .waapi.sentinel")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().top).to.equal(200)
            })
            .get(".img-container:first-child .waapi.sentinel")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().top).to.equal(200)
            })
    })
})

describe("SVG", () => {
    it("tracks SVG elements as target", () => {
        cy.visit("?test=scroll-svg").wait(100).viewport(100, 400)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("0")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("0")
        })
        cy.scrollTo(0, 25)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("0")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("0")
        })
        cy.scrollTo(0, 75)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("0")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("0")
        })
        cy.scrollTo(0, 500)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("1")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("1")
        })
        cy.scrollTo(0, 600)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("1")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("1")
        })
    })
})

describe("scroll() full height target", () => {
    it("doesn't return progress 1 before it hits its first offset", () => {
        cy.visit("?test=scroll-fill-range")
            .wait(100)
            .get("#content")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0")
            })
    })
})

describe.skip("scroll() container tracking", () => {
    it("correctly tracks position of a target with container of fixed height", () => {
        cy.visit("?test=scroll-explicit-height")
            .viewport(800, 500)
            .wait(100)
            .get("#scroll-container")
            .scrollTo(0, 139)
            .wait(100)
            .get("#item-0")
            .should(([$element]: any) => {
                expect(parseInt($element.style.opacity)).to.equal(1)
            })
            .get("#scroll-container")
            .scrollTo(0, 1000)
            .wait(100)
            .get("#item-2")
            .should(([$element]: any) => {
                expect($element.style.opacity).not.to.equal("0")
                expect($element.style.opacity).not.to.equal("1")
            })
    })
})

describe("scroll() dynamic content", () => {
    it("Recalculates window scrollYProgress when content is added below", () => {
        cy.visit("?test=scroll-progress-dynamic-content")
            .wait(100)
            .viewport(100, 400)

        // Scroll to bottom (100% with 2 screens of content)
        cy.scrollTo("bottom")
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect(parseFloat($element.innerText)).to.be.greaterThan(0.95)
            })

        // Wait for dynamic content to load
        cy.get("#content-loaded").should("contain", "loaded").wait(200)

        // Progress should recalculate WITHOUT scrolling - now we're ~50% down
        cy.get("#progress").should(([$element]: any) => {
            expect(parseFloat($element.innerText)).to.be.lessThan(0.7)
        })
    })

    it("Recalculates element scrollYProgress when content is added", () => {
        cy.visit("?test=scroll-progress-dynamic-content-element").wait(100)

        // Scroll to bottom of element (100% with 2 screens of content)
        cy.get("#scroller")
            .scrollTo("bottom")
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect(parseFloat($element.innerText)).to.be.greaterThan(0.95)
            })

        // Wait for dynamic content to load
        cy.get("#content-loaded").should("contain", "loaded").wait(200)

        // Progress should recalculate WITHOUT scrolling - now we're ~50% down
        cy.get("#progress").should(([$element]: any) => {
            expect(parseFloat($element.innerText)).to.be.lessThan(0.7)
        })
    })
})

describe("scroll() programmatic scrolling", () => {
    it("Updates scroll progress after programmatic window.scrollTo()", () => {
        cy.visit("?test=scroll-programmatic").wait(100).viewport(400, 400)

        // Verify initial progress is 0
        cy.get("#progress").should(([$element]: any) => {
            expect(parseFloat($element.innerText)).to.equal(0)
        })

        // Click button to trigger programmatic scrollTo
        // The test page checks progress after 2 animation frames
        cy.get("#scroll-to-btn")
            .click()
            .wait(200)
            .get("#immediate-progress")
            .should(([$element]: any) => {
                const progress = parseFloat($element.innerText)
                // Should be approximately 0.5 (middle of page)
                const isClose = progress >= 0.49 && progress <= 0.51
                expect(isClose).to.equal(true)
            })
    })

    it("Updates scroll progress after programmatic window.scrollBy()", () => {
        cy.visit("?test=scroll-programmatic").wait(100).viewport(400, 400)

        // Verify initial progress is 0
        cy.get("#progress").should(([$element]: any) => {
            expect(parseFloat($element.innerText)).to.equal(0)
        })

        // Click button to trigger programmatic scrollBy
        // The test page checks progress after 2 animation frames
        cy.get("#scroll-by-btn")
            .click()
            .wait(300)
            .get("#immediate-progress")
            .should(([$element]: any) => {
                const progress = parseFloat($element.innerText)
                // Should be approximately 0.5 (middle of page)
                const isClose = progress >= 0.49 && progress <= 0.51
                expect(isClose).to.equal(true)
            })
    })

    it("Reports correct initial progress when scroll tracking starts after page is scrolled", () => {
        // This tests the scenario where scroll tracking is set up AFTER
        // the page has already been scrolled (e.g., browser restored scroll position)
        cy.visit("?test=scroll-programmatic-initial").viewport(400, 400)

        // Wait for tracker to be mounted (page scrolls first, then tracker mounts)
        cy.get("#tracker-mounted")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("true")
            })
            .wait(200)

        // The initial progress should be approximately 0.5 since page was scrolled to middle
        cy.get("#initial-progress").should(([$element]: any) => {
            const progress = parseFloat($element.innerText)
            // Should be approximately 0.5 (middle of page)
            const isClose = progress >= 0.49 && progress <= 0.51
            expect(isClose).to.equal(true)
        })
    })

    it("Updates target scroll progress after DOM reorder - #2748", () => {
        // This tests issue #2748 where useScroll with target doesn't
        // recognize position changes after DOM reordering
        cy.visit("?test=scroll-target-reorder").viewport(400, 800).wait(200)

        // Store initial progress for comparison
        let initialProgress = 0

        // Get initial progress (target is in position 3)
        cy.get("#progress")
            .should(([$element]: any) => {
                initialProgress = parseFloat(
                    $element.innerText.replace("Progress: ", "")
                )
                // Should be some value based on target's initial position
                expect(initialProgress).to.be.greaterThan(0)
            })
            // Reorder items - moves target from position 3 to position 1 (top)
            .get("#reorder-btn")
            .click()
            .wait(200)

        // After reorder, progress should CHANGE since target moved up in DOM
        // If the library doesn't re-measure, the progress will be the SAME
        // This is the bug described in #2748
        cy.get("#progress").should(([$element]: any) => {
            const newProgress = parseFloat(
                $element.innerText.replace("Progress: ", "")
            )
            // Progress should be DIFFERENT after reorder
            // Target moved from position 3 to position 1, so its offset changed
            expect(newProgress).not.to.equal(initialProgress)
        })
    })
})
