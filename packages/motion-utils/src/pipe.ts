/**
 * Pipe
 * Compose other transformers to run linearily
 * pipe(min(20), max(40))
 * @param  {...functions} transformers
 * @return {function}
 */
const combineFunctions = (a: Function, b: Function) => (v: any) => b(a(v))
export const pipe = (...transformers: Function[]) =>
    transformers.reduce(combineFunctions)
