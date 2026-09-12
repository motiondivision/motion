export class WithPromise {
    /**
     * The promise and its resolver are only created when `finished` is
     * first read. Most animations are never awaited, so this saves a
     * Promise allocation per value animation.
     */
    private _finished?: Promise<void>

    private _resolve?: VoidFunction

    private isResolved = false

    get finished() {
        if (!this._finished) {
            this._finished = this.isResolved
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                      this._resolve = resolve
                  })
        }

        return this._finished
    }

    protected updateFinished() {
        this._finished = this._resolve = undefined
        this.isResolved = false
    }

    protected notifyFinished() {
        this.isResolved = true
        this._resolve?.()
    }

    /**
     * Allows the animation to be awaited.
     *
     * @deprecated Use `finished` instead.
     */
    then(onResolve: VoidFunction, onReject?: VoidFunction) {
        return this.finished.then(onResolve, onReject)
    }
}
