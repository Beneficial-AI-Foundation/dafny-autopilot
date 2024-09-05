predicate InArray(a: array<int>, x: int)
    reads a
{
    exists i :: 0 <= i < a.Length && a[i] == x
}

method RemoveElements(a: array<int>, b: array<int>) returns (result: seq<int>)
    // Lengths of a and b must be greater than 0
    // All elements in the output are in a and not in b
    // The elements in the output are all different
{
    var res: seq<int> := [];
    for i := 0 to a.Length
    {
        if !InArray(b, a[i]) && a[i] !in res
        {
            res := res + [a[i]];
        }
    }

    result := res;
}
