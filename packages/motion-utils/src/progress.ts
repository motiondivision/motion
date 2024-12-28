/*
  Progress within given range

  Given a lower limit and an upper limit, we return the progress
  (expressed as a number 0-1) represented by the given value, and
  limit that progress to within 0-1.

  @param [number]: Lower limit
  @param [number]: Upper limit
  @param [number]: Value to find progress within given range
  @return [number]: Progress of value within range as expressed 0-1
*/
export const progress = (from: number, to: number, value: number) => {
    const toFromDifference = to - from

    return toFromDifference === 0 ? 1 : (value - from) / toFromDifference
}
