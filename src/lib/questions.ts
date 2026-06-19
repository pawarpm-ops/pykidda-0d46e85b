// Code-based Python questions used by both Practice and Mock Tests.
// Each question runs in-browser via Pyodide; graded against deterministic test cases.

export type Difficulty = "easy" | "medium" | "hard";

export type TestCase = {
  // Optional stdin fed to the program via input() calls.
  stdin?: string;
  // Expected exact stdout (trailing whitespace trimmed per line, ignored at end).
  expected: string;
  // Optional human label for the test row.
  label?: string;
};

export type CodeQuestion = {
  id: string;
  unit: number;
  difficulty: Difficulty;
  title: string;
  prompt: string;
  starterCode: string;
  tests: TestCase[];
  hint: string;
  solution: string;
  marks: number;
};

const Q = (
  id: string,
  unit: number,
  difficulty: Difficulty,
  title: string,
  prompt: string,
  starterCode: string,
  tests: TestCase[],
  hint: string,
  solution: string,
  marks = 5,
): CodeQuestion => ({ id, unit, difficulty, title, prompt, starterCode, tests, hint, solution, marks });

export const QUESTIONS: CodeQuestion[] = [
  // ─────────────── EASY ───────────────
  Q(
    "e-hello",
    1,
    "easy",
    "Hello, PY Kidda!",
    "Print exactly: Hello, PY Kidda!",
    `# Print the welcome message exactly as shown.\n`,
    [{ expected: "Hello, PY Kidda!" }],
    "Use the print() function with the exact string.",
    `print("Hello, PY Kidda!")`,
    2,
  ),
  Q(
    "e-sum",
    2,
    "easy",
    "Sum of two numbers",
    "Read two integers from input (one per line) and print their sum.",
    `a = int(input())\nb = int(input())\n# print the sum below\n`,
    [
      { stdin: "3\n5\n", expected: "8" },
      { stdin: "10\n-4\n", expected: "6" },
      { stdin: "0\n0\n", expected: "0" },
    ],
    "print(a + b)",
    `a = int(input())\nb = int(input())\nprint(a + b)`,
    3,
  ),
  Q(
    "e-even-odd",
    2,
    "easy",
    "Even or Odd",
    "Read an integer N and print 'Even' if it is even, otherwise 'Odd'.",
    `n = int(input())\n# your code here\n`,
    [
      { stdin: "4\n", expected: "Even" },
      { stdin: "7\n", expected: "Odd" },
      { stdin: "0\n", expected: "Even" },
    ],
    "Use the modulo operator: n % 2 == 0.",
    `n = int(input())\nprint("Even" if n % 2 == 0 else "Odd")`,
    3,
  ),
  Q(
    "e-table",
    2,
    "easy",
    "Multiplication Table",
    "Read N and print its multiplication table from 1 to 10 in the form: N x i = result",
    `n = int(input())\n# your code here\n`,
    [
      {
        stdin: "2\n",
        expected:
          "2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n2 x 10 = 20",
      },
    ],
    "Use a for loop from 1 to 10 inclusive.",
    `n = int(input())\nfor i in range(1, 11):\n    print(f"{n} x {i} = {n*i}")`,
    3,
  ),
  Q(
    "e-reverse-str",
    2,
    "easy",
    "Reverse a string",
    "Read a string and print it reversed.",
    `s = input()\n# your code here\n`,
    [
      { stdin: "python\n", expected: "nohtyp" },
      { stdin: "PY Kidda\n", expected: "addiK YP" },
    ],
    "Slicing: s[::-1]",
    `s = input()\nprint(s[::-1])`,
    3,
  ),

  // ─────────────── MEDIUM ───────────────
  Q(
    "m-factorial",
    2,
    "medium",
    "Factorial",
    "Read a non-negative integer N and print N! (0! = 1).",
    `n = int(input())\n# your code here\n`,
    [
      { stdin: "0\n", expected: "1" },
      { stdin: "5\n", expected: "120" },
      { stdin: "8\n", expected: "40320" },
    ],
    "Loop multiply, or use math.factorial.",
    `import math\nn = int(input())\nprint(math.factorial(n))`,
    5,
  ),
  Q(
    "m-prime",
    2,
    "medium",
    "Prime check",
    "Read N and print 'Prime' if N is a prime number, else 'Not Prime'.",
    `n = int(input())\n# your code here\n`,
    [
      { stdin: "2\n", expected: "Prime" },
      { stdin: "9\n", expected: "Not Prime" },
      { stdin: "17\n", expected: "Prime" },
      { stdin: "1\n", expected: "Not Prime" },
    ],
    "Trial division up to sqrt(N). Handle N < 2 specially.",
    `n = int(input())\nif n < 2:\n    print("Not Prime")\nelse:\n    p = True\n    i = 2\n    while i*i <= n:\n        if n % i == 0:\n            p = False; break\n        i += 1\n    print("Prime" if p else "Not Prime")`,
    5,
  ),
  Q(
    "m-fizzbuzz",
    2,
    "medium",
    "FizzBuzz",
    "Print numbers from 1 to N. For multiples of 3 print 'Fizz', of 5 print 'Buzz', of both print 'FizzBuzz'.",
    `n = int(input())\n# your code here\n`,
    [
      {
        stdin: "15\n",
        expected:
          "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
      },
    ],
    "Check 15 first, else 3, else 5, else number.",
    `n = int(input())\nfor i in range(1, n+1):\n    if i % 15 == 0: print("FizzBuzz")\n    elif i % 3 == 0: print("Fizz")\n    elif i % 5 == 0: print("Buzz")\n    else: print(i)`,
    5,
  ),
  Q(
    "m-bank",
    3,
    "medium",
    "BankAccount class",
    "Implement a class BankAccount with deposit(amount) and withdraw(amount). Withdraw should print 'Insufficient' if balance < amount. Then run the driver code that creates an account starting at 100, deposits 50, withdraws 200, withdraws 80, and prints the final balance.",
    `class BankAccount:\n    def __init__(self, balance=0):\n        self.balance = balance\n    # add deposit and withdraw\n\nacc = BankAccount(100)\nacc.deposit(50)\nacc.withdraw(200)\nacc.withdraw(80)\nprint(acc.balance)\n`,
    [{ expected: "Insufficient\n70" }],
    "Withdraw should only deduct if enough balance; otherwise print 'Insufficient'.",
    `class BankAccount:\n    def __init__(self, balance=0):\n        self.balance = balance\n    def deposit(self, amt):\n        self.balance += amt\n    def withdraw(self, amt):\n        if self.balance < amt:\n            print("Insufficient")\n        else:\n            self.balance -= amt\n\nacc = BankAccount(100)\nacc.deposit(50)\nacc.withdraw(200)\nacc.withdraw(80)\nprint(acc.balance)`,
    6,
  ),
  Q(
    "m-word-count",
    2,
    "medium",
    "Word frequency",
    "Read a line of text and print each unique word with its count, one per line, in alphabetical order: word=count",
    `line = input()\n# your code here\n`,
    [
      {
        stdin: "the quick brown fox the lazy fox\n",
        expected: "brown=1\nfox=2\nlazy=1\nquick=1\nthe=2",
      },
    ],
    "Split by spaces, use a dict or collections.Counter, then sort keys.",
    `from collections import Counter\nline = input()\nc = Counter(line.split())\nfor w in sorted(c):\n    print(f"{w}={c[w]}")`,
    5,
  ),

  // ─────────────── HARD ───────────────
  Q(
    "h-fib",
    2,
    "hard",
    "Fibonacci series",
    "Read N (N ≥ 1) and print the first N Fibonacci numbers space-separated on one line. Start with 0 1.",
    `n = int(input())\n# your code here\n`,
    [
      { stdin: "1\n", expected: "0" },
      { stdin: "2\n", expected: "0 1" },
      { stdin: "7\n", expected: "0 1 1 2 3 5 8" },
    ],
    "Maintain two variables a, b; iterate N times.",
    `n = int(input())\na, b = 0, 1\nout = []\nfor _ in range(n):\n    out.append(str(a))\n    a, b = b, a + b\nprint(" ".join(out))`,
    7,
  ),
  Q(
    "h-anagram",
    2,
    "hard",
    "Anagram check",
    "Read two strings (one per line). Print 'Yes' if they are anagrams (case-insensitive, ignore spaces), else 'No'.",
    `a = input()\nb = input()\n# your code here\n`,
    [
      { stdin: "Listen\nSilent\n", expected: "Yes" },
      { stdin: "Hello\nWorld\n", expected: "No" },
      { stdin: "Conversation\nVoices rant on\n", expected: "Yes" },
    ],
    "Normalize: lower(), remove spaces, then compare sorted chars.",
    `a = input().lower().replace(" ", "")\nb = input().lower().replace(" ", "")\nprint("Yes" if sorted(a) == sorted(b) else "No")`,
    7,
  ),
  Q(
    "h-shape-hierarchy",
    3,
    "hard",
    "Shape inheritance",
    "Create a base class Shape with method area() returning 0. Subclasses Rectangle(w, h) and Circle(r) override area. Then read a line containing either 'R w h' or 'C r' and print the area rounded to 2 decimals.",
    `import math\n\nclass Shape:\n    def area(self):\n        return 0\n\n# Add Rectangle and Circle here\n\nparts = input().split()\n# build the right shape from parts and print area rounded to 2 decimals\n`,
    [
      { stdin: "R 4 5\n", expected: "20.00" },
      { stdin: "C 3\n", expected: "28.27" },
    ],
    "Use math.pi for Circle. Format with f'{x:.2f}'.",
    `import math\nclass Shape:\n    def area(self): return 0\nclass Rectangle(Shape):\n    def __init__(self,w,h): self.w,self.h=w,h\n    def area(self): return self.w*self.h\nclass Circle(Shape):\n    def __init__(self,r): self.r=r\n    def area(self): return math.pi*self.r*self.r\np = input().split()\nif p[0]=='R':\n    s = Rectangle(float(p[1]), float(p[2]))\nelse:\n    s = Circle(float(p[1]))\nprint(f"{s.area():.2f}")`,
    8,
  ),
  Q(
    "h-numpy-mean",
    4,
    "hard",
    "Mean without NumPy",
    "Read N then N space-separated floats on the next line. Print mean rounded to 3 decimals.",
    `n = int(input())\nnums = list(map(float, input().split()))\n# your code here\n`,
    [
      { stdin: "5\n1 2 3 4 5\n", expected: "3.000" },
      { stdin: "3\n2.5 2.5 2.5\n", expected: "2.500" },
    ],
    "sum(nums)/n, format with :.3f.",
    `n = int(input())\nnums = list(map(float, input().split()))\nprint(f"{sum(nums)/n:.3f}")`,
    7,
  ),
  Q(
    "h-csv-totals",
    5,
    "hard",
    "CSV row totals",
    "Read N then N lines, each a CSV row of integers. For each row, print 'row<index>=sum'. Index starts at 1.",
    `n = int(input())\n# read n lines and print row totals\n`,
    [
      {
        stdin: "3\n1,2,3\n10,20\n5,5,5,5\n",
        expected: "row1=6\nrow2=30\nrow3=20",
      },
    ],
    "Split each line by ',' and sum the integers.",
    `n = int(input())\nfor i in range(1, n+1):\n    parts = input().split(",")\n    print(f"row{i}={sum(int(x) for x in parts)}")`,
    7,
  ),

  // ─────────────── From Syllabus PDF (SY-MDM AI&DS Python Assignment) ───────────────
  // Unit 2 — Programming Constructs
  Q(
    "syl-u2-sum-mixed",
    2,
    "medium",
    "Sum of integers in a mixed list",
    "Read a single line of space-separated tokens (mix of numbers and words). Print the sum of only the integer-looking tokens. If no integers are present, print 0. (Syllabus Unit 2 Q4)",
    `line = input()\n# parse tokens; sum only the ones that look like ints\n`,
    [
      { stdin: "1 hello 2 world 3\n", expected: "6" },
      { stdin: "py kidda\n", expected: "0" },
      { stdin: "10 -4 abc 5\n", expected: "11" },
    ],
    "Loop tokens; try int(t) inside try/except; accumulate.",
    `line = input()\ntotal = 0\nfor t in line.split():\n    try:\n        total += int(t)\n    except ValueError:\n        pass\nprint(total)`,
    5,
  ),
  Q(
    "syl-u2-vowels-per-word",
    2,
    "medium",
    "Vowels per word",
    "Read a sentence. Print each word and its vowel count as word:count, space-separated, in the original order. (Syllabus Unit 2 Q5)",
    `s = input()\n# your code here\n`,
    [
      { stdin: "hello world\n", expected: "hello:2 world:1" },
      { stdin: "PY Kidda rocks\n", expected: "PY:0 Kidda:2 rocks:1" },
    ],
    "vowels = 'aeiouAEIOU'; sum(1 for c in word if c in vowels)",
    `s = input()\nvowels = set("aeiouAEIOU")\nout = [f"{w}:{sum(1 for c in w if c in vowels)}" for w in s.split()]\nprint(" ".join(out))`,
    5,
  ),
  Q(
    "syl-u2-char-counts",
    2,
    "medium",
    "Digit / alpha / space / special counts",
    "Read a string. Print four numbers space-separated: digits alphabets whitespaces specials. (Syllabus Unit 2 Q8)",
    `s = input()\n# your code here\n`,
    [
      { stdin: "Hi 123!\n", expected: "3 2 1 1" },
      { stdin: "a b c\n", expected: "0 3 2 0" },
    ],
    "Iterate characters and increment four counters using .isdigit/.isalpha/.isspace.",
    `s = input()\nd=a=w=sp=0\nfor c in s:\n    if c.isdigit(): d+=1\n    elif c.isalpha(): a+=1\n    elif c.isspace(): w+=1\n    else: sp+=1\nprint(d, a, w, sp)`,
    5,
  ),
  Q(
    "syl-u2-primes-in-list",
    2,
    "medium",
    "Primes from a list",
    "Read a line of space-separated integers. Print only the prime numbers in the same order, space-separated. If none, print an empty line. (Syllabus Unit 2 Q10)",
    `nums = list(map(int, input().split()))\n# your code here\n`,
    [
      { stdin: "1 2 3 4 5 6 7 8 9 10\n", expected: "2 3 5 7" },
      { stdin: "15 21 22\n", expected: "" },
    ],
    "Write is_prime(n): n<2 → False; trial divide up to sqrt(n).",
    `def is_prime(n):\n    if n<2: return False\n    i=2\n    while i*i<=n:\n        if n%i==0: return False\n        i+=1\n    return True\nnums = list(map(int, input().split()))\nprint(" ".join(str(x) for x in nums if is_prime(x)))`,
    6,
  ),
  Q(
    "syl-u2-palindrome",
    2,
    "easy",
    "Palindrome check",
    "Read a string. Print 'Yes' if it is a palindrome (case-insensitive), else 'No'. (Syllabus Unit 2 Q14)",
    `s = input()\n# your code here\n`,
    [
      { stdin: "Madam\n", expected: "Yes" },
      { stdin: "python\n", expected: "No" },
      { stdin: "Racecar\n", expected: "Yes" },
    ],
    "Lowercase the string, compare with its reverse.",
    `s = input().lower()\nprint("Yes" if s == s[::-1] else "No")`,
    4,
  ),

  // Unit 3 — OOP
  Q(
    "syl-u3-circle-area",
    3,
    "easy",
    "Circle area class",
    "Read a float r. Create a Circle class with method area() that returns π·r². Print the area rounded to 2 decimals. (Syllabus Unit 3 Q2)",
    `import math\nr = float(input())\n# define Circle and print area\n`,
    [
      { stdin: "1\n", expected: "3.14" },
      { stdin: "2.5\n", expected: "19.63" },
    ],
    "Use math.pi. Format with f'{x:.2f}'.",
    `import math\nclass Circle:\n    def __init__(self, r): self.r = r\n    def area(self): return math.pi * self.r * self.r\nr = float(input())\nprint(f"{Circle(r).area():.2f}")`,
    4,
  ),
  Q(
    "syl-u3-account",
    3,
    "medium",
    "Account deposit / withdraw",
    "Implement class Account(balance). Methods: deposit(amt), withdraw(amt) → prints 'Insufficient' if balance < amt else deducts. Driver: starting 500, deposit 200, withdraw 1000, withdraw 300, then print final balance. (Syllabus Unit 3 Q12)",
    `class Account:\n    def __init__(self, balance):\n        self.balance = balance\n    # add deposit, withdraw\n\nacc = Account(500)\nacc.deposit(200)\nacc.withdraw(1000)\nacc.withdraw(300)\nprint(acc.balance)\n`,
    [{ expected: "Insufficient\n400" }],
    "Withdraw deducts only if enough balance; otherwise prints exactly 'Insufficient'.",
    `class Account:\n    def __init__(self, balance): self.balance = balance\n    def deposit(self, amt): self.balance += amt\n    def withdraw(self, amt):\n        if self.balance < amt: print("Insufficient")\n        else: self.balance -= amt\nacc = Account(500)\nacc.deposit(200)\nacc.withdraw(1000)\nacc.withdraw(300)\nprint(acc.balance)`,
    6,
  ),
  Q(
    "syl-u3-vehicle-poly",
    3,
    "medium",
    "Vehicle polymorphism",
    "Base class Vehicle with method start_engine() printing 'Engine started'. Subclasses Bike and Car override it to print 'Bike roars' and 'Car purrs'. Create a list [Bike(), Car(), Vehicle()] and call start_engine on each, in order. (Syllabus Unit 3 Q15)",
    `# define classes and run the loop\n`,
    [{ expected: "Bike roars\nCar purrs\nEngine started" }],
    "Override start_engine in Bike and Car; iterate the list.",
    `class Vehicle:\n    def start_engine(self): print("Engine started")\nclass Bike(Vehicle):\n    def start_engine(self): print("Bike roars")\nclass Car(Vehicle):\n    def start_engine(self): print("Car purrs")\nfor v in [Bike(), Car(), Vehicle()]:\n    v.start_engine()`,
    6,
  ),

  // Unit 4 — Standard Library
  Q(
    "syl-u4-month-name",
    4,
    "easy",
    "Month name from number",
    "Read an integer M (1–12). Using the calendar module, print the full English month name. (Syllabus Unit 4 Q2)",
    `import calendar\nm = int(input())\n# your code here\n`,
    [
      { stdin: "1\n", expected: "January" },
      { stdin: "7\n", expected: "July" },
      { stdin: "12\n", expected: "December" },
    ],
    "calendar.month_name[m] gives the full name.",
    `import calendar\nm = int(input())\nprint(calendar.month_name[m])`,
    4,
  ),
  Q(
    "syl-u4-matrix-sums",
    4,
    "medium",
    "Row & column sums of a matrix",
    "Read R and C, then R lines of C space-separated integers. Print R row sums on the first line (space-separated), then C column sums on the second line. (Syllabus Unit 4 Q18)",
    `r, c = map(int, input().split())\nmat = [list(map(int, input().split())) for _ in range(r)]\n# your code here\n`,
    [
      { stdin: "2 3\n1 2 3\n4 5 6\n", expected: "6 15\n5 7 9" },
      { stdin: "1 4\n1 1 1 1\n", expected: "4\n1 1 1 1" },
    ],
    "Row sums: sum(row). Column sums: zip(*mat).",
    `r, c = map(int, input().split())\nmat = [list(map(int, input().split())) for _ in range(r)]\nprint(" ".join(str(sum(row)) for row in mat))\nprint(" ".join(str(sum(col)) for col in zip(*mat)))`,
    6,
  ),

  // Unit 5 — CSV
  Q(
    "syl-u5-csv-filter",
    5,
    "medium",
    "CSV filter by threshold",
    "First line: integer N and integer T separated by a space. Next N lines: CSV row 'name,score'. Print 'name=score' for every row where score > T, in original order. (Syllabus Unit 5 Q12)",
    `n, t = map(int, input().split())\n# read n CSV rows and filter by score > t\n`,
    [
      { stdin: "3 50\nAsha,80\nRavi,40\nMeera,55\n", expected: "Asha=80\nMeera=55" },
      { stdin: "2 100\nA,50\nB,60\n", expected: "" },
    ],
    "Split each line by ','; convert score to int; compare.",
    `n, t = map(int, input().split())\nfor _ in range(n):\n    name, score = input().split(",")\n    if int(score) > t:\n        print(f"{name}={score}")`,
    6,
  ),

  // Unit 6 — Data preprocessing (logic-only)
  Q(
    "syl-u6-missing-pct",
    6,
    "medium",
    "Missing value percentages",
    "First line: integer C (columns). Second line: C column names space-separated. Third line: integer R (rows). Next R lines: C tokens space-separated; '?' marks a missing value. For each column, print 'col=pct' where pct is the percentage of missing values rounded to 1 decimal, in the original column order. (Syllabus Unit 6 Q2)",
    `c = int(input())\ncols = input().split()\nr = int(input())\nrows = [input().split() for _ in range(r)]\n# your code here\n`,
    [
      { stdin: "3\nname age city\n4\nA 20 X\nB ? Y\n? 30 ?\nD 40 Z\n", expected: "name=25.0\nage=25.0\ncity=25.0" },
      { stdin: "2\nx y\n2\n1 2\n3 4\n", expected: "x=0.0\ny=0.0" },
    ],
    "For column i, count rows where rows[k][i] == '?', divide by R, multiply by 100.",
    `c = int(input())\ncols = input().split()\nr = int(input())\nrows = [input().split() for _ in range(r)]\nfor i, name in enumerate(cols):\n    miss = sum(1 for k in range(r) if rows[k][i] == "?")\n    pct = (miss / r) * 100\n    print(f"{name}={pct:.1f}")`,
    7,
  ),
];

export const UNITS = [
  { id: 1, title: "Introduction to Python", blurb: "Interpreter, PVM, script vs interactive." },
  { id: 2, title: "Programming Constructs", blurb: "Data types, loops, functions, strings." },
  { id: 3, title: "Object-Oriented Programming", blurb: "Classes, inheritance, polymorphism." },
  { id: 4, title: "Standard Library", blurb: "math, random, NumPy, Pandas basics." },
  { id: 5, title: "GUI & CSV Files", blurb: "csv, logging, Tkinter." },
  { id: 6, title: "Data Preprocessing", blurb: "Missing data, encoding, Seaborn." },
] as const;

// Practice helpers
export function questionsByDifficulty(d: Difficulty): CodeQuestion[] {
  return QUESTIONS.filter((q) => q.difficulty === d);
}
export function getQuestion(id: string) {
  return QUESTIONS.find((q) => q.id === id);
}

// Mock tests built from the same pool
export type MockTest = {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  questionIds: string[];
};

export const MOCK_TESTS: MockTest[] = [
  {
    id: "mock-warmup",
    name: "Warm-up Mock Test",
    description: "5 easy coding questions to build confidence — basic syntax, I/O, loops.",
    durationSec: 20 * 60,
    questionIds: ["e-hello", "e-sum", "e-even-odd", "e-table", "e-reverse-str"],
  },
  {
    id: "mock-core",
    name: "Core Concepts Mock Test",
    description: "Medium coding questions across loops, strings, OOP basics.",
    durationSec: 35 * 60,
    questionIds: ["m-factorial", "m-prime", "m-fizzbuzz", "m-word-count", "m-bank"],
  },
  {
    id: "mock-challenge",
    name: "Challenge Mock Test",
    description: "Hard coding problems — OOP hierarchy, algorithms, file-style I/O.",
    durationSec: 50 * 60,
    questionIds: ["h-fib", "h-anagram", "h-shape-hierarchy", "h-numpy-mean", "h-csv-totals"],
  },
  {
    id: "mock-full",
    name: "Full Syllabus Mock Test",
    description: "Mix of easy / medium / hard from every unit. Final exam style.",
    durationSec: 60 * 60,
    questionIds: ["e-sum", "e-table", "m-prime", "m-bank", "h-fib", "h-shape-hierarchy", "h-csv-totals"],
  },
];

export function getMockTest(id: string) {
  return MOCK_TESTS.find((t) => t.id === id);
}
export function mockTestQuestions(t: MockTest): CodeQuestion[] {
  return t.questionIds.map((id) => QUESTIONS.find((q) => q.id === id)!).filter(Boolean);
}
