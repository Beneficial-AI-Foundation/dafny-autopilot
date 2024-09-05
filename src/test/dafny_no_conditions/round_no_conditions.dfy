// RUN: %dafny /compile:0 /dprint:"%t.dprint" "%s" > "%t"
// RUN: %diff "%s.expect" "%t"

// The RoundDown and RoundUp methods in this file are the ones in the Boogie
// implementation Source/AbsInt/IntervalDomain.cs.

class Rounding {
  var thresholds: array<int>

  function Valid(): bool
    reads this, thresholds
  {
    forall m,n :: 0 <= m < n < thresholds.Length ==> thresholds[m] <= thresholds[n]
  }

  method RoundDown(k: int) returns (r: int)
// The thresholds array is sorted
// Return index that is either -1 or within the bounds of the thresholds array
// All elements after index r are greater than k
// The element at index r is less than or equal to k
  {
    if (thresholds.Length == 0 || k < thresholds[0]) {
      return -1;
    }
    var i, j := 0, thresholds.Length - 1;
    while (i < j)
    {
      var mid := i + (j - i + 1) / 2;
      if (thresholds[mid] <= k) {
        i := mid;
      } else {
        j := mid - 1;
      }
    }
    return i;
  }

  method RoundUp(k: int) returns (r: int)
// The thresholds array is sorted
// Return index that is within the bounds of the thresholds array
// All elements before index r are less than k
// The element at index r is greater than or equal to k
  {
    if (thresholds.Length == 0 || thresholds[thresholds.Length-1] < k) {
      return thresholds.Length;
    }
    var i, j := 0, thresholds.Length - 1;
    while (i < j)
    {
      var mid := i + (j - i) / 2;
      if (thresholds[mid] < k) {
        i := mid + 1;
      } else {
        j := mid;
      }
    }
    return i;
  }
}
