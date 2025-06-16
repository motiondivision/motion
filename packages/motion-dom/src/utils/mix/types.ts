export type Mixer<T> = (p: number) => T

export type MixerFactory<T> = (a: T, b: T) => Mixer<T>
