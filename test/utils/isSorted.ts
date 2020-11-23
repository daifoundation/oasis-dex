export const isSorted = <T>(array: T[], comparator: (lhs: T, rhs: T) => boolean) => {
  const limit = array.length - 1
  return array.every((_, index) => (index < limit ? comparator(array[index], array[index + 1]) : true))
}
