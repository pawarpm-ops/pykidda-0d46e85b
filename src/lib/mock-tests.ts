export type Question = {
  id: string;
  unit: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  marks: number;
};

export type MockTest = {
  id: string;
  name: string;
  unit: number | "mixed";
  durationSec: number;
  description: string;
  questions: Question[];
};

const q = (
  id: string,
  unit: number,
  text: string,
  options: string[],
  correctIndex: number,
  explanation: string,
  marks = 1,
): Question => ({ id, unit, text, options, correctIndex, explanation, marks });

const UNIT_QUESTIONS: Question[] = [
  // Unit 1
  q("u1-1", 1, "Python is primarily a:", ["Compiled language", "Interpreted language", "Assembly language", "Markup language"], 1, "Python source is executed by the Python interpreter (PVM) line-by-line after bytecode compilation."),
  q("u1-2", 1, "PVM stands for:", ["Python Virtual Machine", "Public Virtual Memory", "Python Variable Module", "Portable Vector Machine"], 0, "PVM = Python Virtual Machine, which runs the compiled .pyc bytecode."),
  q("u1-3", 1, "Which mode executes a saved .py file?", ["Interactive mode", "Script mode", "Shell mode", "Debug mode"], 1, "Script mode runs a .py file end-to-end; interactive mode evaluates statements one at a time."),
  q("u1-4", 1, "Bytecode files in Python have the extension:", [".py", ".pyc", ".pyo", ".pyb"], 1, ".pyc files store the compiled bytecode produced before PVM execution."),
  q("u1-5", 1, "Compared to a compiler, an interpreter typically:", ["Produces faster machine code", "Executes line-by-line", "Cannot run scripts", "Requires linking"], 1, "Interpreters translate and execute one statement at a time."),

  // Unit 2
  q("u2-1", 2, "Which of these is an immutable type?", ["list", "dict", "set", "tuple"], 3, "Tuples are immutable; lists, dicts, sets are mutable."),
  q("u2-2", 2, "Output of len('Python')?", ["5", "6", "7", "Error"], 1, "'Python' has 6 characters."),
  q("u2-3", 2, "Which loop is guaranteed to run at least once in Python?", ["for", "while", "do-while", "None"], 3, "Python has no do-while; both for and while may execute zero times."),
  q("u2-4", 2, "Which keyword handles exceptions?", ["catch", "except", "rescue", "handle"], 1, "Python uses try/except/finally."),
  q("u2-5", 2, "Default function argument is evaluated:", ["Each call", "Once at definition", "Never", "At import only if used"], 1, "Default args are evaluated once when the function is defined — a common gotcha with mutable defaults."),

  // Unit 3
  q("u3-1", 3, "The first parameter of an instance method is:", ["cls", "this", "self", "instance"], 2, "By convention, self refers to the instance."),
  q("u3-2", 3, "Which supports multiple inheritance?", ["Java", "C#", "Python", "JavaScript"], 2, "Python supports multiple inheritance using MRO (C3 linearization)."),
  q("u3-3", 3, "A method shared by all instances and not dependent on instance state is best as:", ["instance method", "classmethod or staticmethod", "lambda", "generator"], 1, "Use @classmethod or @staticmethod for class-level behaviour."),
  q("u3-4", 3, "Polymorphism in Python is typically achieved via:", ["Method overloading", "Duck typing & overriding", "Pointer arithmetic", "Templates"], 1, "Python relies on duck typing and method overriding rather than signature-based overloading."),
  q("u3-5", 3, "__init__ is called:", ["When the class is defined", "When an instance is created", "When the program exits", "Only on inheritance"], 1, "__init__ runs right after __new__ when constructing an instance."),

  // Unit 4
  q("u4-1", 4, "Which module provides random numbers?", ["math", "random", "statistics", "secrets only"], 1, "The random module provides pseudo-random number generators."),
  q("u4-2", 4, "NumPy's core data structure is:", ["DataFrame", "Series", "ndarray", "list"], 2, "ndarray is NumPy's n-dimensional array."),
  q("u4-3", 4, "In Pandas, a 2D labeled table is a:", ["Series", "DataFrame", "Panel", "Index"], 1, "DataFrame is the 2D labeled tabular structure."),
  q("u4-4", 4, "Matplotlib's most common pyplot import alias is:", ["mpl", "plt", "pyplot", "mp"], 1, "import matplotlib.pyplot as plt is the standard."),
  q("u4-5", 4, "math.sqrt(16) returns:", ["4", "4.0", "16", "Error"], 1, "math.sqrt returns a float."),

  // Unit 5
  q("u5-1", 5, "Which module reads/writes CSV files in the standard library?", ["pandas", "csv", "json", "io"], 1, "The csv module is built-in for delimited file I/O."),
  q("u5-2", 5, "Which Tkinter widget displays a single line of text input?", ["Label", "Text", "Entry", "Canvas"], 2, "Entry is for single-line input; Text is multi-line."),
  q("u5-3", 5, "Default logging level in Python is:", ["DEBUG", "INFO", "WARNING", "ERROR"], 2, "The root logger defaults to WARNING."),
  q("u5-4", 5, "To open a CSV file for writing without extra blank lines on Windows, use:", ["mode='w'", "mode='w', newline=''", "mode='wb'", "mode='a+'"], 1, "newline='' avoids the extra \\r issue with csv.writer."),
  q("u5-5", 5, "Tkinter's main event loop is started with:", ["root.start()", "root.run()", "root.mainloop()", "tk.loop()"], 2, "mainloop() starts the GUI event loop."),

  // Unit 6
  q("u6-1", 6, "Which Pandas method drops missing values?", ["fillna()", "dropna()", "isnull()", "remove()"], 1, "dropna() removes NaN rows/columns."),
  q("u6-2", 6, "Z-score is used primarily to detect:", ["Categorical encoding", "Missing data", "Outliers", "Duplicates"], 2, "Z-score measures standard deviations from the mean — large values indicate outliers."),
  q("u6-3", 6, "One-hot encoding converts:", ["Numerics to bins", "Categoricals to binary columns", "Strings to lowercase", "Dates to timestamps"], 1, "Each category becomes its own 0/1 column."),
  q("u6-4", 6, "Seaborn is built on top of:", ["Plotly", "Bokeh", "Matplotlib", "Altair"], 2, "Seaborn wraps Matplotlib with higher-level statistical plots."),
  q("u6-5", 6, "Scikit-learn's StandardScaler transforms data to have:", ["min 0, max 1", "mean 0, std 1", "sum 1", "median 0"], 1, "StandardScaler standardises features to zero mean and unit variance."),
];

export const UNITS = [
  { id: 1, title: "Introduction to Python", blurb: "Interpreter, PVM, script vs interactive, compiler vs interpreter." },
  { id: 2, title: "Programming Constructs", blurb: "Data types, loops, functions, exceptions, strings, scope." },
  { id: 3, title: "Object-Oriented Programming", blurb: "Classes, inheritance, polymorphism, methods." },
  { id: 4, title: "Standard Library", blurb: "datetime, math, random, NumPy, Pandas, Matplotlib." },
  { id: 5, title: "GUI & CSV Files", blurb: "csv module, logging, Tkinter GUI programming." },
  { id: 6, title: "Data Preprocessing", blurb: "Missing data, outliers, encoding, Seaborn, Scikit-learn." },
] as const;

const unitTests: MockTest[] = UNITS.map((u) => ({
  id: `mock-unit-${u.id}`,
  name: `Unit ${u.id} Mock Test — ${u.title}`,
  unit: u.id as number,
  durationSec: 5 * 60,
  description: u.blurb as string,
  questions: UNIT_QUESTIONS.filter((qq) => qq.unit === u.id),
}));

export const MOCK_TESTS: MockTest[] = [
  ...unitTests,
  {
    id: "mock-mixed",
    name: "Full Syllabus Mock Test",
    unit: "mixed",
    durationSec: 15 * 60,
    description: "A mixed mock test covering all six units of the Python syllabus.",
    questions: UNIT_QUESTIONS,
  },
];

export function getMockTest(id: string) {
  return MOCK_TESTS.find((t) => t.id === id);
}
