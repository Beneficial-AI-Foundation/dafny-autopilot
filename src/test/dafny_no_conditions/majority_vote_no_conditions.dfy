function Count<T(==)>(a: seq<T>, s: int, t: int, x: T): int
// Start index 's' must be <= end index 't', which must be <= the length of the sequence a
{
  if s == t then 0 else
  Count(a, s, t-1, x) + if a[t-1] == x then 1 else 0
}

ghost predicate HasMajority<T>(a: seq<T>, s: int, t: int, x: T)
// Start index 's' must be <= end index 't', which must be <= the length of the sequence a
{
  2 * Count(a, s, t, x) > t - s
}

// Here is the first version of the algorithm, the one that assumes there is a majority choice.

method FindWinner<Candidate(==)>(a: seq<Candidate>, ghost K: Candidate) returns (k: Candidate)
// Candidate K has a (strict) majority of the votes
// Find K
{
  k := a[0];
  var n, c, s := 1, 1, 0;
  while n < |a|
  {
    if a[n] == k {
      n, c := n + 1, c + 1;
    } else if 2 * c > n + 1 - s {
      n := n + 1;
    } else {
      n := n + 1;
      // We have 2*Count(a, s, n, k) == n-s, and thus the following lemma
      // lets us conclude 2*Count(a, s, n, K) <= n-s.
      Lemma_Unique(a, s, n, K, k);
      // We also have 2*Count(a, s, |a|, K) > |a|-s, and the following lemma
      // tells us Count(a, s, |a|, K) == Count(a, s, n, K) + Count(a, n, |a|, K),
      // and thus we can conclude 2*Count(a, n, |a|, K) > |a|-n.
      Lemma_Split(a, s, n, |a|, K);
      k, n, c, s := a[n], n + 1, 1, n;
    }
  }
  Lemma_Unique(a, s, |a|, K, k);  // both k and K have a majority, so K == k
}

// ------------------------------------------------------------------------------

// Here is the second version of the program, the one that also computes whether or not
// there is a majority choice.

datatype Result<Candidate> = NoWinner | Winner(cand: Candidate)

method DetermineElection<Candidate(==,0,!new)>(a: seq<Candidate>) returns (result: Result<Candidate>)
// If there is a winner, then the winner has a majority of the votes
// If there is no winner, then no candidate has a majority of the votes
{
  if |a| == 0 { return NoWinner; }
  ghost var b := exists c :: 2 * Count(a, 0, |a|, c) > |a|;
  ghost var w :| b ==> 2 * Count(a, 0, |a|, w) > |a|;
  var cand := SearchForWinner(a, b, w);
  return if 2 * Count(a, 0, |a|, cand) > |a| then Winner(cand) else NoWinner;
}

// The difference between SearchForWinner for FindWinner above are the occurrences of the
// antecedent "hasWinner ==>" and the two checks for no-more-votes that may result in a "return"
// statement.

method SearchForWinner<Candidate(==)>(a: seq<Candidate>, ghost hasWinner: bool, ghost K: Candidate) returns (k: Candidate)
// Input sequence a is not empty
// Candidate K has a (strict) majority of the votes
// Find K
{
  k := a[0];
  var n, c, s := 1, 1, 0;
  while n < |a|
  {
    if a[n] == k {
      n, c := n + 1, c + 1;
    } else if 2 * c > n + 1 - s {
      n := n + 1;
    } else {
      n := n + 1;
      // We have 2*Count(a, s, n, k) == n-s, and thus the following lemma
      // lets us conclude 2*Count(a, s, n, K) <= n-s.
      Lemma_Unique(a, s, n, K, k);
      // We also have 2*Count(a, s, |a|, K) > |a|-s, and the following lemma
      // tells us Count(a, s, |a|, K) == Count(a, s, n, K) + Count(a, n, |a|, K),
      // and thus we can conclude 2*Count(a, n, |a|, K) > |a|-n.
      Lemma_Split(a, s, n, |a|, K);
      if |a| == n { return; }
      k, n, c, s := a[n], n + 1, 1, n;
    }
  }
  Lemma_Unique(a, s, |a|, K, k);  // both k and K have a majority, so K == k
}

// ------------------------------------------------------------------------------

// Here are two lemmas about Count that are used in the methods above.

lemma Lemma_Split<T>(a: seq<T>, s: int, t: int, u: int, x: T)
// Index 's' must be <= index 't', and 't' must be <= index 'u', which must be <= the length of the sequence a
// Number of occurrences of x in a[s..u] is equal to the sum of the numbers of occurrences of x in a[s..t] and a[t..u]
{
  /* The postcondition of this method is proved automatically via Dafny's
     induction tactic.  But if a manual proof had to be provided, it would
     look like this:
  if s != t {
    Lemma_Split(a, s, t-1, u, x);
  }
  */
}

lemma Lemma_Unique<T>(a: seq<T>, s: int, t: int, x: T, y: T)
// Start index 's' must be <= end index 't', which must be <= the length of the sequence a
// If x, y are different, then the number of occurrences of x and y in a[s..t] is at most the length of the subsequence
{
  /* The postcondition of this method is proved automatically via Dafny's
     induction tactic.  But if a manual proof had to be provided, it would
     look like this:
  if s != t {
    Lemma_Unique(a, s, t-1, x, y);
  }
  */
}

// ------------------------------------------------------------------------------

// This version uses more calculations with integer formulas
method FindWinner'<Candidate(==)>(a: seq<Candidate>, ghost K: Candidate) returns (k: Candidate)
// Candidate K has a (strict) majority of the votes
// Find K
{
  k := a[0]; // Current candidate: the first element
  var lo, up, c := 0, 1, 1; // Window: [0..1], number of occurrences of k in the window: 1
  while up < |a|
  {
    if a[up] == k {
      // One more occurrence of k
      up, c := up + 1, c + 1;
    } else if 2 * c > up + 1 - lo {
      // An occurrence of another value, but k still has the majority
      up := up + 1;
    } else {
      // An occurrence of another value and k just lost the majority.
      // Prove that k has exactly 50% in the future window a[lo..up + 1]:
      calc /* k has 50% among a[lo..up + 1] */ {
        true;
      ==  // negation of the previous branch condition;
        2 * c <= up + 1 - lo;
      ==  // loop invariant (3)
        2 * Count(a, lo, up, k) <= up + 1 - lo;
      == calc {
           true;
         ==  // loop invariant (2)
           HasMajority(a, lo, up, k);
         ==  // def. HasMajority
           2 * Count(a, lo, up, k) > up - lo;
         ==
           2 * Count(a, lo, up, k) >= up + 1 - lo;
         }
        2 * Count(a, lo, up, k) == up + 1 - lo;
      }
      up := up + 1;

      // We are going to start a new window a[up..up + 1] and choose a new candidate,
      // so invariants (2) and (3) will be easy to re-establish.
      // To re-establish (1) we have to prove that K has majority among a[up..], as up will become the new lo.
      // The main idea is that we had enough K's in a[lo..], and there cannot be too many in a[lo..up].
      calc /* K has majority among a[up..] */ {
        2 * Count(a, up, |a|, K);
      ==  { Lemma_Split(a, lo, up, |a|, K); }
        2 * Count(a, lo, |a|, K) - 2 * Count(a, lo, up, K);
      >  { assert HasMajority(a, lo, |a|, K); } // loop invariant (1)
        |a| - lo - 2 * Count(a, lo, up, K);
      >=  { if k == K {
              calc {
                2 * Count(a, lo, up, K);
              ==
                2 * Count(a, lo, up, k);
              ==  { assert 2 * Count(a, lo, up, k) == up - lo; } // k has 50% among a[lo..up]
                up - lo;
              }
            } else {
              calc {
                2 * Count(a, lo, up, K);
              <=  { Lemma_Unique(a, lo, up, k, K); }
                2 * ((up - lo) - Count(a, lo, up, k));
              ==  { assert 2 * Count(a, lo, up, k) == up - lo; } // k has 50% among a[lo..up]
                up - lo;
              }
            }
          }
        |a| - lo - (up - lo);
      ==
        |a| - up;
      }

      k, lo, up, c := a[up], up, up + 1, 1;
    }
  }
  Lemma_Unique(a, lo, |a|, K, k);  // both k and K have a majority among a[lo..], so K == k
}

// This version uses more calculations with boolean formulas
method FindWinner''<Candidate(==)>(a: seq<Candidate>, ghost K: Candidate) returns (k: Candidate)
// Candidate K has a (strict) majority of the votes
// Find K
{
  k := a[0]; // Current candidate: the first element
  var lo, up, c := 0, 1, 1; // Window: [0..1], number of occurrences of k in the window: 1
  while up < |a|
  {
    if a[up] == k {
      // One more occurrence of k
      up, c := up + 1, c + 1;
    } else if 2 * c > up + 1 - lo {
      // An occurrence of another value, but k still has the majority
      up := up + 1;
    } else {
      // An occurrence of another value and k just lost the majority.
      // Prove that k has exactly 50% in the future window a[lo..up + 1]:
      calc /* k has 50% among a[lo..up + 1] */ {
        true;
      ==  // negation of the previous branch condition
        2 * c <= up + 1 - lo;
      ==  // loop invariant (3)
        2 * Count(a, lo, up, k) <= up + 1 - lo;
      ==  calc {
            true;
          ==  // loop invariant (2)
            HasMajority(a, lo, up, k);
          ==  // def. HasMajority
            2 * Count(a, lo, up, k) > up - lo;
          ==
            2 * Count(a, lo, up, k) >= up + 1 - lo;
          }
        2 * Count(a, lo, up, k) == up + 1 - lo;
      }
      up := up + 1;

      // We are going to start a new window a[up..up + 1] and choose a new candidate,
      // so invariants (2) and (3) will be easy to re-establish.
      // To re-establish (1) we have to prove that K has majority among a[up..], as up will become the new lo.
      // The main idea is that we had enough K's in a[lo..], and there cannot be too many in a[lo..up].
      calc /* K has majority among a[up..] */ {
        true;
      ==  // loop invariant (1)
        HasMajority(a, lo, |a|, K);
      ==
        2 * Count(a, lo, |a|, K) > |a| - lo;
      ==  { Lemma_Split(a, lo, up, |a|, K); }
        2 * Count(a, lo, up, K) + 2 * Count(a, up, |a|, K) > |a| - lo;
      ==>
        { if k == K {
            calc {
              2 * Count(a, lo, up, K);
            ==
              2 * Count(a, lo, up, k);
            ==  { assert 2 * Count(a, lo, up, k) == up - lo; } // k has 50% among a[lo..up]
              up - lo;
            }
          } else {
            calc {
              true;
            ==  { Lemma_Unique(a, lo, up, k, K); }
              Count(a, lo, up, K) + Count(a, lo, up, k) <= up - lo;
            ==
              2 * Count(a, lo, up, K) + 2 * Count(a, lo, up, k) <= 2 * (up - lo);
            ==  { assert 2 * Count(a, lo, up, k) == up - lo; } // k has 50% among a[lo..up]
              2 * Count(a, lo, up, K) <= up - lo;
            }
          }
        }
        // subtract off Count(a, lo, up, K) from the LHS and subtract off the larger amount up - lo from the RHS
        2 * Count(a, up, |a|, K) > (|a| - lo) - (up - lo);
      ==
        2 * Count(a, up, |a|, K) > |a| - up;
      ==
        HasMajority(a, up, |a|, K);
      }
      k, lo, up, c := a[up], up, up + 1, 1;
    }
  }
  Lemma_Unique(a, lo, |a|, K, k);  // both k and K have a majority among a[lo..], so K == k
}
