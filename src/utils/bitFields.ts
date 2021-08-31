// enum Flags {
//   Administrator = 1 << 0,
// }
function notString<TValue>(value: TValue | string): value is TValue {
  return typeof value !== "string";
}

// const flagKeys = Object.values(Flags).filter(notString);

// function bitFieldHas(bitField: Flags, flag: Flags): boolean {
//   if ((bitField & flag) === flag) return true;
//   return false;
// }

// function getFlagStrings(bitField: Flags) {
//   const response: string[] = [];
//   for (const flag of flagKeys) {
//     if ((bitField & flag) === flag) response.push(Flags[flag]);
//   }
//   return response;
// }
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) == 0 ? true : false;
}

// Returns position of the
// only set bit in 'n'
function findPosition(n: number) {
  if (isPowerOfTwo(n) == false) return -1;

  var i = 1;
  var pos = 0;

  // Iterate through bits of n
  // till we find a set bit i&n
  // will be non-zero only when
  // 'i' and 'n' have a set bit
  // at same position
  while ((i & n) == 0) {
    // Unset current bit and
    // set the next bit in 'i'
    i = i << 1;

    // increment position
    pos += 1;
  }
  return pos;
}

export function findPositions(n: number) {
  const positions: number[] = [];
  var pos = 0;
  while (1 << pos <= n) {
    if (((1 << pos) & n) !== 0) positions.push(pos);
    pos += 1;
  }
  return positions;
}
