export const GRAMMAR_TUTORIAL = `
Dafny Grammar tutorial: Map Comprehension Expression
Examples:

\`\`\`dafny
map x : int | 0 <= x <= 10 :: x * x;
map x : int | 0 <= x <= 10 :: -x := x * x;
function square(x : int) : int { x * x }
method test()
{
  var m := map x : int | 0 <= x <= 10 :: x * x;
  ghost var im := imap x : int :: x * x;
  ghost var im2 := imap x : int :: square(x);
}
\`\`\`

Iterating over the contents of a map uses the component sets: Keys, Values, and Items.
The iteration loop follows the same patterns as for sets:

\`\`\`dafny
method m<T(==),U(==)> (m: map<T,U>) {
  var items := m.Items;
  while items != {}
    decreases |items|
  {
    var item :| item in items;
    items := items - { item };
    print item.0, " ", item.1, "\\n";
  }
}
\`\`\`

Dafny grammar tutorial ends here.
`;


export const SYS_DAFNY = "You are an expert in Dafny. \
You will be given tasks dealing with Dafny programs including precise annotations.\n";


export const GEN_HINTS_FROM_BODY = "Given a Dafny program with function signature, preconditions, postconditions, and code, but with annotations missing. \
Please return a complete Dafny program with the strongest possible annotations (loop invariants, assert statements, etc.) filled back in. \
Be certain that you do not include any uncommented explanation in your response. \
Please use exactly the same function signature, preconditions, and postconditions. Do not ever modify the given lines. \
Below is the program:\n";


export const GEN_DAFNY_FROM_PYTHON = "Given a Python program. \
Please return a complete Dafny program with the strongest possible annotations (loop invariants, assert statements, etc.) filled back in. \
Do not explain. \
Please use exactly the same function signature, preconditions, and postconditions. Do not ever modify the given lines. \
Below is the program:\n";


export const COMPILER_PROMPT = `Role: You are a compiler designed to translate Python code into Dafny code. Your main objective is to produce Dafny code that not only replicates the logic and functionality of the given Python code but also integrates Dafny's verification features to ensure the correctness of the code.

Input: Python code snippet.

Output: Complete Dafny code that:

Replicates the functionality of the Python code.
Utilizes Dafny's type system, method contracts (preconditions, postconditions), and loop invariants to ensure that the code can be verified for correctness using Dafny's verification tools.
Is syntactically correct and adheres to Dafny's coding conventions.
Instructions:

Analyze the structure and logic of the input Python code.
Translate the Python code into Dafny, ensuring that all variables, functions, and logic are correctly converted to their Dafny equivalents.
Include necessary verification elements such as preconditions, postconditions, and loop invariants where applicable to ensure that the Dafny verifier can prove the correctness of the code.
Make a best-effort attempt to handle any complexities or potential translation ambiguities in the Python code.
Output the Dafny code that is ready for compilation and verification in a Dafny development environment.
Example:

Input:

# Python code:
def binary_addition(s,t):
    a = 0;b = 0;
    ys = []
    for i in range(10):
        c = s[i]; d = t[i];
        next_a = b ^ c ^ d
        next_b = b+c+d>1
        a = next_a;b = next_b;
        y = a
        ys.append(y)
    return ys
Output:

// Dafny code:
function ArrayToBv10(arr: array<bool>): bv10 // Converts boolean array to bitvector
    reads arr
    requires arr.Length == 10
{
    ArrayToBv10Helper(arr, arr.Length - 1)
}

function ArrayToBv10Helper(arr: array<bool>, index: nat): bv10
    reads arr
    requires arr.Length == 10
    requires 0 <= index < arr.Length
    decreases index
    ensures forall i :: 0 <= i < index ==> ((ArrayToBv10Helper(arr, i) >> i) & 1) == (if arr
        [i] then 1 else 0)
{
    if index == 0 then
        (if arr[0] then 1 else 0) as bv10
    else
        var bit: bv10 := if arr[index] then 1 as bv10 else 0 as bv10;
        (bit << index) + ArrayToBv10Helper(arr, index - 1)
}

method ArrayToSequence(arr: array<bool>) returns (res: seq<bool>) // Converts boolean array to boolean sequence
    ensures |res| == arr.Length
    ensures forall k :: 0 <= k < arr.Length ==> res[k] == arr[k]
{
    res := [];
    var i := 0;
    while i < arr.Length
        invariant 0 <= i <= arr.Length
        invariant |res| == i
        invariant forall k :: 0 <= k < i ==> res[k] == arr[k]
        {
            res := res + [arr[i]];
            i := i + 1;
        }
}


function isBitSet(x: bv10, bitIndex: nat): bool
    requires bitIndex < 10
    ensures isBitSet(x, bitIndex) <==> (x & (1 << bitIndex)) != 0
{
    (x & (1 << bitIndex)) != 0
}

function Bv10ToSeq(x: bv10): seq<bool> // Converts bitvector to boolean sequence
    ensures |Bv10ToSeq(x)| == 10
    ensures forall i: nat :: 0 <= i < 10 ==> Bv10ToSeq(x)[i] == isBitSet(x, i)
{
    [isBitSet(x, 0), isBitSet(x, 1), isBitSet(x, 2), isBitSet(x, 3),
    isBitSet(x, 4), isBitSet(x, 5), isBitSet(x, 6), isBitSet(x, 7),
    isBitSet(x, 8), isBitSet(x, 9)]
}

function BoolToInt(a: bool): int 
ensures BoolToInt(a) == if a then 1 else 0
{
    if a then 1 else 0
}

function XOR(a: bool, b: bool): bool
ensures XOR(a, b) == (a != b)
{
   a != b
}

function BitAddition(s: array<bool>, t: array<bool>): bv10 // Performs traditional bit addition
    reads s
    reads t
    requires s.Length == 10 && t.Length == 10
    ensures BitAddition(s, t) == (ArrayToBv10(s) + ArrayToBv10(t))
    ensures BitAddition(s, t) <= 1023
{
    var a: bv10 := ArrayToBv10(s);
    var b: bv10 := ArrayToBv10(t);
    var c: bv10 := a + b;
    assert c <= 1023;
    c
}

function SeqBitAddition(s: array<bool>, t: array<bool>): seq<bool>
    reads s
    reads t
    requires s.Length == 10 && t.Length == 10
    ensures SeqBitAddition(s, t) == Bv10ToSeq(ArrayToBv10(s) + ArrayToBv10(t))
{
    Bv10ToSeq(BitAddition(s, t))
}


method BinaryAddition(s: array<bool>, t: array<bool>) returns (sresult: seq<bool>) // Generated program for bit addition
    requires s.Length == 10 && t.Length == 10
    ensures |sresult| == 10
    ensures SeqBitAddition(s, t) == sresult // Verification of correctness
{
    var a: bool := false;
    var b: bool := false;
    var check: seq<bool> := SeqBitAddition(s, t);
    var result: array<bool> := new bool[10];
    var i: int := 0;
    while i < result.Length
    invariant 0 <= i <= result.Length
    invariant forall j :: 0 <= j < i ==> result[j] == false
    {
        result[i] := false;
        i := i + 1;
    }

    i := 0;

    while i < result.Length
        invariant 0 <= i <= result.Length
        invariant b == (i > 0 && ((s[i-1] || t[i-1]) && !(result[i-1] && (s[i-1] != t[i-1]))))
        invariant forall j :: 0 <= j && j < i ==> result[j] == check[j] 
    {
        result[i] := XOR(b, XOR(s[i], t[i]));

        b := BoolToInt(b) + BoolToInt(s[i]) + BoolToInt(t[i]) > 1;

        i := i + 1;
    }

    sresult := ArrayToSequence(result);
}
Additional Guidance:

If the Python code includes libraries or functions that have no direct equivalent in Dafny, devise a logical equivalent using Dafny's features or simplify the functionality where a direct translation is not feasible.
Ensure that all translated code adheres to both the syntactic rules of Dafny and the functional expectations of the original Python logic.
Be absolutely certain that you return a syntactically correct Dafny program with no additional language. Do not include the \`\`\`dafny prefix or \`\`\` suffix in your response.`;

export const PRECONDITION_PROMPT = `You are an expert in formal verification and Dafny programming.
Your task is to analyze the following Dafny code and identify and add the necessary preconditions to ensure the correctness of the code.
Steps:
1) Ensure that each function, method, lemma, and predicate has at least one precondition.
2) Add the weakest possible preconditions that ensure the correctness of the code.
3) Use the Predicate Transformer Semantics to determine the necessary preconditions.
4) Do not add preconditions if the code is already correct.
5) Tag the new preconditions with "//+LLM" at the end of the line.
6) Retain all existing comments in the code.
Output:
1) Provide a brief bullet-point list of the reasoning behind each added precondition.
2) Return the fixed Dafny code with the added preconditions.
3) Ensure that the code structure remains the same.
Format:
- EXPLANATIONS:\n
  [BRIEF_LIST_OF_ALL_REASONING]\n
- DAFNY_CODE:\n
    \`\`\`dafny\n
    [CODE]\n
    \`\`\`
Rules:
- True Preconditions
- Weakest Preconditions
- No Unnecessary Preconditions
- Tag Added Preconditions with "//+LLM" at the end of the line
- Do Not Change Existing Code Body
Think:
- Step-by-step list of the reasoning behind each added precondition in bullet-point format.
Goal:
- Provide the best possible preconditions for all functions, methods, lemmas, and predicates.
Important:
- Provide a detailed explanation for each added precondition first.
- Do not modify untagged annotations/conditions.
- Do not change the existing code body.
Code Below:
{code}`;

export const POSTCONDITION_PROMPT = `You are an expert in formal verification and Dafny programming.
Your task is to analyze the following Dafny code and identify and add the necessary postconditions to ensure the correctness of the code.
Steps:
1) Ensure that each function, method, lemma, and predicate has at least one postcondition.
2) Add the strongest possible postconditions that ensure the correctness of the code.
3) Use the Predicate Transformer Semantics to determine the necessary postconditions.
4) Do not add postconditions if the code is already correct.
5) Tag the postconditions you add with "//+LLM" at the end of the line.
6) Retain all existing comments in the code.
Output:
1) Provide a brief bullet-point list of the reasoning behind each added postcondition.
2) Return the fixed Dafny code with the added postconditions.
3) Ensure that the code structure remains the same.
Format:
- EXPLANATIONS:\n
  [BRIEF_LIST_OF_ALL_REASONING]\n
  - DAFNY_CODE:\n
    \`\`\`dafny\n
    [CODE]\n
    \`\`\`
Rules:
- True Postconditions
- Strongest Postconditions
- Consider all outcomes of code execution
- No weak or unnecessary postconditions
- Tag New Postconditions with "//+LLM"
- Do Not Change Existing Code Body
Think:
- Step-by-step list of the reasoning behind each added postcondition in bullet-point format.
Goal:
- Provide the best possible postconditions for all functions, methods, lemmas, and predicates.
Important:
- Provide a detailed explanation for each added postcondition first.
- Do not modify untagged annotations/conditions.
- Do not change the existing code body.
Code Below:
{code}`;


export const INVARIANT_PROMPT = `You are an expert in formal verification and Dafny programming.
Your task is to analyze the following Dafny code and identify and add the necessary loop invariants to ensure the correctness of the code.
Steps:
1) Identify all loops in the code.
2) For each loop, analyze the loop's properties and behavior.
3) Formulate at least one loop invariant for each loop that ensures the correctness of the loop.
4) Ensure that the loop invariant is strong enough to prove the correctness of the loop.
5) Do not add loop invariants if the code is already correct.
6) Tag the loop invariants you add with "//+LLM" at the end of the line.
7) Retain all existing comments in the code.
Output:
1) Provide a brief bullet-point list of the reasoning behind each added loop invariant.
2) Provide the fixed Dafny code with the added loop invariants.
3) Ensure that the code structure remains the same.
Format:
- EXPLANATIONS:\n
  [BRIEF_LIST_OF_ALL_REASONING]\n
- DAFNY_CODE:\n
    \`\`\`dafny\n
    [CODE]\n
    \`\`\`
Rules:
- Loop Invariants are True Before, During, and After loop execution.
- Loop Variables must relate to the loop's properties.
- Include Bounds in the loop invariant.
- Consider the Postcondition in the loop invariant.
- Tag Added Loop Invariants with "//+LLM"
- Do Not Change Existing Code Body
- No Unnecessary Loop Invariants
Think:
- Step-by-step list of the reasoning behind each added loop invariant in bullet-point format.
Goal:
- Ensure the correctness of all loops in the code.
Important:
- Provide a detailed explanation for each added loop invariant first.
- Do not modify untagged annotations/conditions.
- Do not change the existing code body.
Code Below:
{code}`;

export const FIX_PROMPT = `You are an expert in formal verification and Dafny programming.
Your task is to analyze the following Dafny code and identify and correct any verification issues present in the code.
Focus on correcting verification annotations such as Requires, Ensures, Loop Invariants, and Decreases clauses to ensure the correctness of the code.
Rules:
- Ensure that all Requires clauses are true before the function or method is executed.
- Ensure that all Ensures clauses are true after the function or method is executed.
- Ensure that all Loop Invariants are true before, during, and after the loop execution.
- Prove the termination of all loops using the Decreases clause.
- Do not change any non-verification code (e.g., function bodies, method implementations).
- Focus on one error at a time.
Input:
- Failed Dafny code with verification issues.
- Output from running the Dafny verifier on the code.
Code: {modified_code}
Issues: {issue}
Steps:
1) Plan the fixes for each verification issue.
2) Implement the planned fixes.
3) Tag the new annotations with "//+LLM" at the end of the line.
4) You may remove any LLM-tagged annotations that are no longer necessary.
5) Ensure that there are no syntax errors in the code.
6) Provide the full Dafny code with the fixes.
Output:
- Brief list of the reasoning behind each fix.
- Entire Dafny code with the fixes.
Constraints:
- Provide a brief list of the reasoning behind each fix.
- Provide the full Dafny code, including unchanged parts.
- Do not alter non-verification code.
- Do not change functions or methods.
- Only modify untagged annotations if they have errors or LLM-tagged ones.
Goal:
- Ensure that the Dafny code passes verification.
Critical:
- Provide a brief list of the reasoning behind each fix.
- Do not change non-verification code.
Output Format:
- EXPLANATION:
  [BRIEF_LIST_REASONING]
- DAFNY_CODE:
    \`\`\`dafny
    [ENTIRE_MODIFIED_CODE]
    \`\`\`
`;

export const FIX_PROMPT2 = `
LLM=DafnyFV_Expert 
Task:AnalyzeDafny→FixVerifIssues
Focus:CorrectVerificationAnnotations(Requires,Ensures,LoopInvariants,Decreases)
Def:VerificationAnnotations=Requires+Ensures+LoopInvariants+Decreases
Def:NonVerificationCode=AllCodeExceptVerificationAnnotations
Output:BrfNumberedListExplanation+EntireDafnyCodeWithFixes
CRITICAL:BriefListExplainThenProvideFullCode+DoNotChangeNonVerificationCode
OutFormat:
EXPLANATION:
[BRIEF_LIST_REASONING]

DAFNY_CODE:
\`\`\`dafny
[ENTIRE_DAFNY_CODE_DO_NOT_OMIT_UNCHANGED_CODE_IN_RESPONSE]
code: {modified_code}
issues: {issue}`;

export const FIX_SYNTAX_PROMPT = `You are an expert in formal verification and Dafny programming. 
    Your task is to analyze the following Dafny code and identify and correct any syntax errors present in the code. 
    Focus on fixing the syntax errors to ensure that the code has correct Dafny syntax. You are not required to address any verification issues at this time.
    Only return the corrected code, including in-code comments. Do not include any additional explanation or comments in your response.
    Here is the code:
    {code}`;