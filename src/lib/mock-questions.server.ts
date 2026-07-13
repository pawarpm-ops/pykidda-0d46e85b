// SERVER-ONLY. Never import from client code — the `.server.ts` suffix keeps
// this out of the browser bundle. Owns the hidden test cases + reference
// solutions for the built-in mock tests so the answer key can't be inspected
// from devtools. Client only ever sees the sanitized view returned by
// `mock-secure.functions.ts`.

export type ServerTestCase = {
  stdin: string;
  expected: string;
};

export type ServerMockQuestion = {
  id: string;
  unit: number;
  title: string;
  prompt: string;
  starterCode: string;
  marks: number;
  tests: ServerTestCase[];
  solution: string;
};

export type ServerMockTest = {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  questionIds: string[];
};

const Q = (
  id: string,
  unit: number,
  title: string,
  prompt: string,
  starterCode: string,
  tests: ServerTestCase[],
  solution: string,
  marks = 4,
): ServerMockQuestion => ({ id, unit, title, prompt, starterCode, marks, tests, solution });

// Mirrored from src/lib/questions.ts. Practice mode still uses the client copy;
// this server copy is the source of truth for mock grading.
const QUESTIONS: ServerMockQuestion[] = [
  Q("q-prime-check", 1, "Prime number with exception handling",
    "Read an integer from input and print 'Prime' or 'Not Prime'. If the input is not a valid integer, print 'Invalid'.",
    `# Read an integer and decide if it is prime.\n# Print 'Invalid' if input is not an integer.\n`,
    [
      { stdin: "7", expected: "Prime" },
      { stdin: "10", expected: "Not Prime" },
      { stdin: "1", expected: "Not Prime" },
      { stdin: "abc", expected: "Invalid" },
    ],
    `try:
    n = int(input())
    if n < 2:
        print("Not Prime")
    else:
        prime = True
        for i in range(2, int(n**0.5) + 1):
            if n % i == 0:
                prime = False
                break
        print("Prime" if prime else "Not Prime")
except ValueError:
    print("Invalid")`),
  Q("q-sum-mixed", 2, "Sum of integers in a mixed list",
    "Read a single line of space-separated tokens (integers and strings mixed). Use try/except to sum only the integers and print the total.",
    `# Sum integers, ignore non-integer tokens.\n`,
    [
      { stdin: "1 2 hello 3 world 4", expected: "10" },
      { stdin: "a b c", expected: "0" },
      { stdin: "10 20 30", expected: "60" },
    ],
    `tokens = input().split()
total = 0
for t in tokens:
    try:
        total += int(t)
    except ValueError:
        pass
print(total)`),
  Q("q-vowels-per-word", 2, "Vowels per word",
    "Read a sentence. Print a dictionary where each word is a key and the number of vowels in it is the value. Preserve word order.",
    `# Build {word: vowel_count} for the input sentence.\n`,
    [
      { stdin: "hello world", expected: "{'hello': 2, 'world': 1}" },
      { stdin: "python rocks", expected: "{'python': 1, 'rocks': 1}" },
    ],
    `s = input()
print({w: sum(1 for c in w.lower() if c in 'aeiou') for w in s.split()})`),
  Q("q-char-counts", 2, "Character counts",
    "Read a string. Print a dictionary with keys 'digits', 'alphabets', 'whitespaces', 'special' showing the count of each in the input.",
    `# Count digits, alphabets, whitespace, special chars.\n`,
    [
      { stdin: "Hello 123!", expected: "{'digits': 3, 'alphabets': 5, 'whitespaces': 1, 'special': 1}" },
      { stdin: "abc", expected: "{'digits': 0, 'alphabets': 3, 'whitespaces': 0, 'special': 0}" },
    ],
    `s = input()
d = {'digits': 0, 'alphabets': 0, 'whitespaces': 0, 'special': 0}
for c in s:
    if c.isdigit(): d['digits'] += 1
    elif c.isalpha(): d['alphabets'] += 1
    elif c.isspace(): d['whitespaces'] += 1
    else: d['special'] += 1
print(d)`),
  Q("q-primes-list", 2, "Primes from a list",
    "Read space-separated integers from input. Print the list of primes (in original order).",
    `# Filter and print primes as a Python list.\n`,
    [
      { stdin: "2 3 4 5 6 7 8 9 10", expected: "[2, 3, 5, 7]" },
      { stdin: "1 4 6 8", expected: "[]" },
      { stdin: "11 13 15 17", expected: "[11, 13, 17]" },
    ],
    `def is_prime(n):
    if n < 2: return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0: return False
    return True
nums = [int(x) for x in input().split()]
print([n for n in nums if is_prime(n)])`),
  Q("q-calculator", 2, "Simple calculator",
    "Line 1: operator (+, -, *, /). Lines 2 and 3: two numbers. Print the result. On division by zero print 'Error: division by zero'. On invalid operator print 'Error: invalid op'.",
    `# Calculator with exception handling.\n`,
    [
      { stdin: "+\n3\n4", expected: "7" },
      { stdin: "*\n5\n6", expected: "30" },
      { stdin: "/\n10\n4", expected: "2.5" },
      { stdin: "/\n10\n0", expected: "Error: division by zero" },
      { stdin: "%\n1\n2", expected: "Error: invalid op" },
    ],
    `op = input().strip()
a = float(input()); b = float(input())
if op == '/' and b == 0:
    print("Error: division by zero")
elif op == '+': r = a + b
elif op == '-': r = a - b
elif op == '*': r = a * b
elif op == '/': r = a / b
else:
    print("Error: invalid op"); r = None
if r is not None and op in '+-*/':
    if r == int(r): print(int(r))
    else: print(r)`,
    8),
  Q("q-word-count", 2, "Word count dictionary",
    "Read a sentence and print a dictionary mapping each word to its count. Preserve first-seen order.",
    `# Build a {word: count} dict from the sentence.\n`,
    [
      { stdin: "the cat and the dog", expected: "{'the': 2, 'cat': 1, 'and': 1, 'dog': 1}" },
      { stdin: "hi hi hi", expected: "{'hi': 3}" },
    ],
    `d = {}
for w in input().split():
    d[w] = d.get(w, 0) + 1
print(d)`,
    8),
  Q("q-string-analysis", 2, "Uppercase, vowels, palindrome",
    "Read a string. Print 3 lines: (1) the string in uppercase, (2) the count of vowels, (3) True/False for palindrome (case-insensitive, alphanumeric only).",
    `# Print uppercase, vowel count, palindrome flag.\n`,
    [
      { stdin: "Racecar", expected: "RACECAR\n3\nTrue" },
      { stdin: "Hello", expected: "HELLO\n2\nFalse" },
    ],
    `s = input()
print(s.upper())
print(sum(1 for c in s.lower() if c in 'aeiou'))
clean = ''.join(c for c in s.lower() if c.isalnum())
print(clean == clean[::-1])`,
    8),
  Q("q-num-analysis", 2, "Even/odd, factorial, prime",
    "Read an integer. Print 3 lines: (1) 'Even' or 'Odd', (2) factorial of its absolute value, (3) 'Prime' or 'Not Prime'.",
    `# Three checks on a single integer.\n`,
    [
      { stdin: "5", expected: "Odd\n120\nPrime" },
      { stdin: "4", expected: "Even\n24\nNot Prime" },
      { stdin: "1", expected: "Odd\n1\nNot Prime" },
    ],
    `import math
n = int(input())
print("Even" if n % 2 == 0 else "Odd")
print(math.factorial(abs(n)))
if n < 2:
    print("Not Prime")
else:
    p = all(n % i for i in range(2, int(n**0.5) + 1))
    print("Prime" if p else "Not Prime")`,
    8),
  Q("q-student-class", 3, "Student class",
    "Read 3 lines, each 'name roll marks'. Define a Student class with a method that prints 'name | Roll: roll | Marks: marks'. Print all 3 students.",
    `# Define Student and print 3 instances.\n`,
    [{ stdin: "Alice 1 90\nBob 2 85\nCara 3 78", expected: "Alice | Roll: 1 | Marks: 90\nBob | Roll: 2 | Marks: 85\nCara | Roll: 3 | Marks: 78" }],
    `class Student:
    def __init__(self, n, r, m):
        self.n, self.r, self.m = n, r, m
    def show(self):
        print(f"{self.n} | Roll: {self.r} | Marks: {self.m}")
for _ in range(3):
    n, r, m = input().split()
    Student(n, r, m).show()`),
  Q("q-circle-area", 3, "Circle class with area()",
    "Define a Circle class with attribute radius and method area(). Read a radius (float) and print the area rounded to 2 decimal places.",
    `# Define Circle, print area to 2 dp.\n`,
    [
      { stdin: "5", expected: "78.54" },
      { stdin: "1", expected: "3.14" },
      { stdin: "2.5", expected: "19.63" },
    ],
    `import math
class Circle:
    def __init__(self, r): self.r = r
    def area(self): return math.pi * self.r * self.r
r = float(input())
print(f"{Circle(r).area():.2f}")`),
  Q("q-account", 3, "Account: deposit & withdraw",
    "Line 1: initial balance. Then lines like 'deposit 50' or 'withdraw 30'. End with 'end'. Print the final balance (int if whole, else float). Withdrawals exceeding the balance are ignored.",
    `# Implement Account class with deposit/withdraw.\n`,
    [
      { stdin: "100\ndeposit 50\nwithdraw 30\nend", expected: "120" },
      { stdin: "200\nwithdraw 500\ndeposit 100\nend", expected: "300" },
      { stdin: "50\nwithdraw 20\nend", expected: "30" },
    ],
    `class Account:
    def __init__(self, b): self.b = b
    def deposit(self, x): self.b += x
    def withdraw(self, x):
        if x <= self.b: self.b -= x
a = Account(float(input()))
while True:
    line = input().strip()
    if line == "end": break
    op, x = line.split()
    x = float(x)
    if op == "deposit": a.deposit(x)
    elif op == "withdraw": a.withdraw(x)
b = a.b
print(int(b) if b == int(b) else b)`,
    8),
  Q("q-rectangle-cuboid", 3, "Rectangle → Cuboid inheritance",
    "Read three numbers 'l w h' on one line. Define Rectangle (area, perimeter) and a derived Cuboid (surface area, volume). Print 4 lines: rectangle area, rectangle perimeter, cuboid surface area, cuboid volume (int if whole, else float).",
    `# Demonstrate inheritance and method reuse.\n`,
    [
      { stdin: "3 4 5", expected: "12\n14\n94\n60" },
      { stdin: "2 2 2", expected: "4\n8\n24\n8" },
    ],
    `class Rectangle:
    def __init__(s, l, w): s.l, s.w = l, w
    def area(s): return s.l * s.w
    def peri(s): return 2 * (s.l + s.w)
class Cuboid(Rectangle):
    def __init__(s, l, w, h):
        super().__init__(l, w); s.h = h
    def sa(s): return 2 * (s.l*s.w + s.w*s.h + s.l*s.h)
    def vol(s): return s.l * s.w * s.h
l, w, h = [float(x) for x in input().split()]
c = Cuboid(l, w, h)
for v in [c.area(), c.peri(), c.sa(), c.vol()]:
    print(int(v) if v == int(v) else v)`,
    8),
  Q("q-vehicle-poly", 3, "Vehicle polymorphism",
    "Define a Vehicle base class with start_engine(). Derive Bike and Car overriding it to print 'Bike engine started' and 'Car engine started'. Loop through [Bike(), Car()] and call start_engine() on each.",
    `# Demonstrate polymorphism.\n`,
    [{ stdin: "", expected: "Bike engine started\nCar engine started" }],
    `class Vehicle:
    def start_engine(self): print("Generic engine")
class Bike(Vehicle):
    def start_engine(self): print("Bike engine started")
class Car(Vehicle):
    def start_engine(self): print("Car engine started")
for v in [Bike(), Car()]:
    v.start_engine()`,
    8),
  Q("q-month-name", 4, "Month name from number",
    "Read an integer 1-12. Print the full English month name (e.g. 'January').",
    `# Use the calendar module.\n`,
    [
      { stdin: "1", expected: "January" },
      { stdin: "7", expected: "July" },
      { stdin: "12", expected: "December" },
    ],
    `import calendar
n = int(input())
print(calendar.month_name[n])`),
  Q("q-matrix-sums", 4, "4×4 matrix row & column sums",
    "Read 4 lines each containing 4 integers separated by spaces. Print two lines: 'Row sums: [..]' and 'Col sums: [..]'.",
    `# Compute and print row and column sums.\n`,
    [
      { stdin: "1 2 3 4\n5 6 7 8\n9 10 11 12\n13 14 15 16", expected: "Row sums: [10, 26, 42, 58]\nCol sums: [28, 32, 36, 40]" },
      { stdin: "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1", expected: "Row sums: [1, 1, 1, 1]\nCol sums: [1, 1, 1, 1]" },
    ],
    `m = [[int(x) for x in input().split()] for _ in range(4)]
print("Row sums:", [sum(r) for r in m])
print("Col sums:", [sum(c) for c in zip(*m)])`,
    8),
  Q("q-days-until", 4, "Days remaining until a date",
    "Line 1: a base date (YYYY-MM-DD). Line 2: a target date (YYYY-MM-DD). Print the number of days from base to target as an integer.",
    `# Use datetime.date.\n`,
    [
      { stdin: "2025-01-01\n2025-12-31", expected: "364" },
      { stdin: "2026-06-19\n2026-06-20", expected: "1" },
      { stdin: "2025-12-31\n2025-01-01", expected: "-364" },
    ],
    `from datetime import date
a = date.fromisoformat(input().strip())
b = date.fromisoformat(input().strip())
print((b - a).days)`,
    8),
];

const MOCK_TESTS: ServerMockTest[] = [
  { id: "mock-warmup", name: "Warm-up Mock Test",
    description: "5 quick questions to build confidence — basics, strings, and a class.",
    durationSec: 20 * 60,
    questionIds: ["q-prime-check", "q-month-name", "q-circle-area", "q-vehicle-poly", "q-num-analysis"] },
  { id: "mock-core", name: "Core Concepts Mock Test",
    description: "Strings, dictionaries, loops, and exception handling across Unit 2.",
    durationSec: 35 * 60,
    questionIds: ["q-vowels-per-word", "q-word-count", "q-string-analysis", "q-primes-list", "q-char-counts"] },
  { id: "mock-oop", name: "OOP Mock Test",
    description: "Object-oriented programming: classes, inheritance, polymorphism.",
    durationSec: 40 * 60,
    questionIds: ["q-student-class", "q-circle-area", "q-account", "q-rectangle-cuboid", "q-vehicle-poly"] },
  { id: "mock-full", name: "Full Syllabus Mock Test",
    description: "A mix of every unit. Final-exam style.",
    durationSec: 60 * 60,
    questionIds: [
      "q-prime-check", "q-calculator", "q-word-count", "q-account",
      "q-rectangle-cuboid", "q-matrix-sums", "q-days-until",
    ] },
];

export function serverGetMockTest(id: string): ServerMockTest | undefined {
  return MOCK_TESTS.find((t) => t.id === id);
}

export function serverGetMockQuestion(id: string): ServerMockQuestion | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function serverMockQuestions(t: ServerMockTest): ServerMockQuestion[] {
  return t.questionIds.map((id) => QUESTIONS.find((q) => q.id === id)!).filter(Boolean);
}

// Normalized comparison, matched to the client-side pyodide-runner.
export function normalizeOutput(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}
