/*
  Convert velocity into velocity per second

  @param [number]: Unit per frame
  @param [number]: Frame duration in ms
*/
export function velocityPerSecond(velocity: number, frameDuration: number) {
    return frameDuration ? velocity * (1000 / frameDuration) : 0
}
