/**
 * Pipe
 * Compose other transformers to run linearily
 * pipe(min(20), max(40))
 * @param  {...functions} transformers
 * @return {function}
 */
const combineFunctions = (a: Function, b: Function) => (v: any) => b(a(v))
export const pipe = (...transformers: Function[]) => {
    if (transformers.length === 0) return (v: any) => v
    if (transformers.length === 1) return transformers[0]
    return transformers.reduce(combineFunctions)
}
