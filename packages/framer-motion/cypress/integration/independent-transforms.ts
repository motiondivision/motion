describe("independent transform acceleration", () => {
    it("runs x, y, scale and rotate as separate native animations", () => {
        cy.visit("?test=independent-transforms")
            .wait(5000)
            .get("#box")
            .then(([$box]: any) => {
                const animations = $box.getAnimations()
                expect(animations.length).to.equal(3)
                expect($box.style.transform).to.equal("none")

                const { translate, scale, rotate } = getComputedStyle($box)
                const [x, y] = translate.split(" ").map(parseFloat)
                expect(x).to.be.greaterThan(40)
                expect(x).to.be.lessThan(60)
                expect(y).to.be.greaterThan(20)
                expect(y).to.be.lessThan(30)
                expect(parseFloat(scale)).to.be.greaterThan(1.4)
                expect(parseFloat(scale)).to.be.lessThan(1.6)
                expect(parseFloat(rotate)).to.be.greaterThan(40)
                expect(parseFloat(rotate)).to.be.lessThan(50)
            })
    })

    it("keeps x running natively when scale starts mid-flight", () => {
        cy.visit("?test=independent-transforms-interrupt")
            .wait(2000)
            .get("#box")
            .then(([$box]: any) => {
                const animations = $box.getAnimations()
                const xAnimation = (window as any).xAnimation
                expect(animations.length).to.equal(2)
                expect(animations.includes(xAnimation)).to.equal(true)
                expect(Number(xAnimation.currentTime)).to.be.greaterThan(1700)
            })
    })

    it("continues both values on the main thread when one is interrupted", () => {
        cy.visit("?test=independent-transforms-demote")
            .wait(2500)
            .get("#result")
            .then(([$result]: any) => {
                const result = JSON.parse($result.textContent)
                expect(result.animations).to.equal(0)
                expect(result.minOffset).to.be.greaterThan(5)
                expect(result.y).to.be.greaterThan(12)
            })
    })

    it("pause, seek and speed control the native animation", () => {
        cy.visit("?test=independent-transforms-controls")
            .wait(1000)
            .get("#result")
            .then(([$result]: any) => {
                expect(JSON.parse($result.textContent)).to.deep.equal({
                    animations: 1,
                    paused: "paused",
                    currentTime: 5000,
                    playbackRate: 2,
                    playing: "running",
                    sameAnimation: true,
                })
            })
    })

    it("carries velocity into an interrupting spring", () => {
        cy.visit("?test=independent-transforms-velocity")
            .wait(3000)
            .get("#result")
            .then(([$result]: any) => {
                const result = JSON.parse($result.textContent)
                expect(result.maxOffset).to.be.greaterThan(
                    result.interruptedAt + 5
                )
                expect(result.left).to.be.lessThan(result.interruptedAt)
            })
    })

    it("keeps layout, transformTemplate and perspective on the main thread", () => {
        cy.visit("?test=independent-transforms-fallback")
            .wait(1000)
            .get("#layout")
            .then(([$box]: any) => {
                expect($box.getAnimations().length).to.equal(0)
                expect($box.style.transform).to.contain("translateX")
            })
            .get("#template")
            .then(([$box]: any) => {
                expect($box.getAnimations().length).to.equal(0)
                expect($box.style.transform).to.contain("skewX")
            })
            .get("#perspective")
            .then(([$box]: any) => {
                expect($box.getAnimations().length).to.equal(0)
                expect($box.style.transform).to.contain("perspective")
            })
            .get("#repeat")
            .then(([$box]: any) => {
                const [animation] = $box.getAnimations()
                expect(
                    animation.effect.getComputedTiming().iterations
                ).to.equal(Infinity)
            })
    })
})
