import { expect } from 'chai'

import { isSorted } from './isSorted'

describe('isSorted', () => {
  const testCases = [
    { array: [1, 2, 3], expected: true },
    { array: [1, 200, 300], expected: true },
    { array: [-31, -20, 3], expected: true },
    { array: [5, 5, 5], expected: true },
    { array: [1, 3, 3], expected: true },
    { array: [-1, -1, -1], expected: true },
    { array: [-1, -1, -1], expected: true },
    { array: [1, -3, -30], expected: false },
    { array: [31, -20, 3], expected: false },
    { array: [-1, -1, -2], expected: false },
    { array: [1, 2, 0], expected: false },
    { array: [500, 1, 2], expected: false },
    { array: [], expected: true },
  ]
  testCases.forEach(({ array, expected }) =>
    it(`array ${JSON.stringify(array)} is${expected ? '' : ' not'} sorted`, () => {
      const ascending = (lhs: number, rhs: number) => rhs >= lhs
      expect(isSorted(array, ascending)).to.eql(expected)
    }),
  )
})
