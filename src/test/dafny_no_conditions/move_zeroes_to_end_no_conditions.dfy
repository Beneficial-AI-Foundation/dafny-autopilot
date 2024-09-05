method MoveZeroesToEnd(arr: array<int>)
    
{
    var i := 0;
    var j := 0;

    while j < arr.Length
        
    {

        if arr[j] != 0
        {
            if i != j
            {
                swap(arr, i, j);
            }
            i := i + 1;
        }
        j := j + 1;
    }
}

method swap(arr: array<int>, i: int, j: int)
    
{
        var tmp := arr[i];
        arr[i] := arr[j];
        arr[j] := tmp;
}

function count(arr: seq<int>, value: int) : (c: nat)
{
    if |arr| == 0 then 0 else (if arr[0] == value then 1 else 0) + count(arr[1..], value)
}
