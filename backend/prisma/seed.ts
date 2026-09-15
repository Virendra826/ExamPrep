import { PrismaClient, Role, QuestionType, QuestionSource, QuestionStatus, Difficulty } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // ---------------------------------------------------------------------------
  // 1. Seed Users
  // ---------------------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash("AdminDev123!", 10);
  const studentPasswordHash = await bcrypt.hash("StudentDev123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@examprep.dev" },
    update: {
      name: "Dev Administrator",
      password_hash: adminPasswordHash,
      role: Role.ADMIN,
      is_active: true,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "admin@examprep.dev",
      name: "Dev Administrator",
      password_hash: adminPasswordHash,
      role: Role.ADMIN,
      is_active: true,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@examprep.dev" },
    update: {
      name: "Dev Student",
      password_hash: studentPasswordHash,
      role: Role.STUDENT,
      is_active: true,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      email: "student@examprep.dev",
      name: "Dev Student",
      password_hash: studentPasswordHash,
      role: Role.STUDENT,
      is_active: true,
    },
  });

  console.log(`✅ Seeded users: Admin (${admin.email}), Student (${student.email})`);

  // ---------------------------------------------------------------------------
  // 2. Seed Subjects & Chapters
  // ---------------------------------------------------------------------------
  const subjectsData = [
    {
      id: "00000001-0000-0000-0000-000000000001",
      name: "Compiler Design",
      description: "Principles, techniques, and tools for building programming language translators.",
      chapters: [
        {
          id: "00000001-0001-0000-0000-000000000001",
          name: "Lexical Analysis",
          description: "Tokens, regular expressions, transition diagrams, and finite automata.",
        },
        {
          id: "00000001-0002-0000-0000-000000000002",
          name: "Syntax Analysis & Parsing",
          description: "Context-free grammars, top-down LL(1) parsing, and bottom-up LR/LALR parsing.",
        },
        {
          id: "00000001-0003-0000-0000-000000000003",
          name: "Code Generation & Optimization",
          description: "Intermediate representations, basic blocks, flow graphs, and DAG representations.",
        },
      ],
    },
    {
      id: "00000002-0000-0000-0000-000000000002",
      name: "Operating Systems",
      description: "Core concepts of process scheduling, virtual memory, concurrency, and file systems.",
      chapters: [
        {
          id: "00000002-0001-0000-0000-000000000001",
          name: "Processes & CPU Scheduling",
          description: "Process states, context switching, threads, and scheduling algorithms.",
        },
        {
          id: "00000002-0002-0000-0000-000000000002",
          name: "Memory Management & Paging",
          description: "Contiguous allocation, paging, segmentation, TLBs, and page replacement.",
        },
        {
          id: "00000002-0003-0000-0000-000000000003",
          name: "Deadlocks & Synchronization",
          description: "Critical section problem, semaphores, mutexes, and Banker's algorithm.",
        },
      ],
    },
    {
      id: "00000003-0000-0000-0000-000000000003",
      name: "DBMS",
      description: "Database system design, relational algebra, SQL querying, and transaction processing.",
      chapters: [
        {
          id: "00000003-0001-0000-0000-000000000001",
          name: "Relational Model & ER Diagrams",
          description: "Entities, attributes, relationships, relational schema constraints, and keys.",
        },
        {
          id: "00000003-0002-0000-0000-000000000002",
          name: "SQL & Relational Algebra",
          description: "Relational operators, joins, tuple relational calculus, and SQL queries.",
        },
        {
          id: "00000003-0003-0000-0000-000000000003",
          name: "Transactions & Concurrency Control",
          description: "ACID properties, serializability, two-phase locking (2PL), and recovery techniques.",
        },
      ],
    },
  ];

  const chapterMap = new Map<string, string>();

  for (const s of subjectsData) {
    const subject = await prisma.subject.upsert({
      where: { name: s.name },
      update: { description: s.description, is_active: true },
      create: { id: s.id, name: s.name, description: s.description, is_active: true },
    });

    for (const c of s.chapters) {
      const chapter = await prisma.chapter.upsert({
        where: {
          subject_id_name: {
            subject_id: subject.id,
            name: c.name,
          },
        },
        update: { description: c.description, is_active: true },
        create: {
          id: c.id,
          subject_id: subject.id,
          name: c.name,
          description: c.description,
          is_active: true,
        },
      });
      chapterMap.set(`${s.name}::${c.name}`, chapter.id);
    }
  }

  console.log("✅ Seeded 3 subjects and 9 chapters.");

  // Helper getters
  const getChapterId = (subjectName: string, chapterName: string): string => {
    const id = chapterMap.get(`${subjectName}::${chapterName}`);
    if (!id) throw new Error(`Missing chapter: ${subjectName}::${chapterName}`);
    return id;
  };

  const getSubjectId = (name: string): string => {
    const found = subjectsData.find((s) => s.name === name);
    if (!found) throw new Error(`Missing subject: ${name}`);
    return found.id;
  };

  // ---------------------------------------------------------------------------
  // 3. Seed Questions (10 per subject = 30 questions)
  // ---------------------------------------------------------------------------
  const questions = [
    // ==========================================
    // COMPILER DESIGN (10 questions: 5 Concept, 5 PYQ)
    // ==========================================
    {
      id: "10000000-0000-0000-0001-000000000001",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Lexical Analysis"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "Which phase of the compiler generates the stream of tokens from source characters?",
      options: [
        { id: "A", text: "Lexical Analyzer" },
        { id: "B", text: "Syntax Analyzer" },
        { id: "C", text: "Semantic Analyzer" },
        { id: "D", text: "Intermediate Code Generator" },
      ],
      correct_answer: "A",
      explanation: "The Lexical Analyzer (scanner) reads input characters and groups them into meaningful sequences called lexemes, outputting tokens.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0001-000000000002",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Lexical Analysis"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "In a compiler, an identifier is represented by which of the following formal grammar types?",
      options: [
        { id: "A", text: "Regular Language" },
        { id: "B", text: "Context-Free Language" },
        { id: "C", text: "Context-Sensitive Language" },
        { id: "D", text: "Recursively Enumerable Language" },
      ],
      correct_answer: "A",
      explanation: "Identifiers and tokens are described using regular expressions, which correspond to regular languages recognized by finite automata.",
      exam_name: "GATE CS",
      exam_year: 2022,
    },
    {
      id: "10000000-0000-0000-0001-000000000003",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Lexical Analysis"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "What data structure is predominantly used by the lexical analyzer and compiler to store identifiers and their attributes?",
      options: [
        { id: "A", text: "Stack" },
        { id: "B", text: "Symbol Table" },
        { id: "C", text: "Queue" },
        { id: "D", text: "B-Tree" },
      ],
      correct_answer: "B",
      explanation: "The Symbol Table is the central data structure used to record information about identifiers such as type, scope, and memory location.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0001-000000000004",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Syntax Analysis & Parsing"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "Which of the following conditions is required for a grammar to be parsed by an LL(1) parser?",
      options: [
        { id: "A", text: "It must be left-recursive" },
        { id: "B", text: "It must be free of left-recursion and left-factored" },
        { id: "C", text: "It must contain ambiguous productions" },
        { id: "D", text: "It must be an operator grammar" },
      ],
      correct_answer: "B",
      explanation: "An LL(1) top-down parser cannot handle left recursion and requires grammars to be left-factored to ensure deterministic choice of production.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0001-000000000005",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Syntax Analysis & Parsing"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.HARD,
      question_text: "Which of the following bottom-up parsers has the largest number of states for the same context-free grammar?",
      options: [
        { id: "A", text: "SLR(1)" },
        { id: "B", text: "LR(0)" },
        { id: "C", text: "LALR(1)" },
        { id: "D", text: "Canonical LR(1)" },
      ],
      correct_answer: "D",
      explanation: "Canonical LR(1) keeps distinct states for different lookaheads, resulting in many more states than SLR(1) and LALR(1), which merge compatible states.",
      exam_name: "GATE CS",
      exam_year: 2021,
    },
    {
      id: "10000000-0000-0000-0001-000000000006",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Syntax Analysis & Parsing"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "A grammar with the production E -> E + E | id is:",
      options: [
        { id: "A", text: "Unambiguous and LL(1)" },
        { id: "B", text: "Ambiguous" },
        { id: "C", text: "Unambiguous and LR(1)" },
        { id: "D", text: "Operator precedence grammar" },
      ],
      correct_answer: "B",
      explanation: "The production generates multiple parse trees for expressions like id + id + id because associativity and precedence are unspecified.",
      exam_name: "GATE CS",
      exam_year: 2020,
    },
    {
      id: "10000000-0000-0000-0001-000000000007",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Syntax Analysis & Parsing"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "Shift-reduce conflicts in bottom-up parsing occur when the parser cannot decide whether to:",
      options: [
        { id: "A", text: "Shift a terminal onto the stack or reduce by a production" },
        { id: "B", text: "Reduce by production A or reduce by production B" },
        { id: "C", text: "Push an error token or accept" },
        { id: "D", text: "Backtrack or terminate" },
      ],
      correct_answer: "A",
      explanation: "A shift-reduce conflict occurs when both a valid shift action and a valid reduce action exist for the current state and lookahead.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0001-000000000008",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Code Generation & Optimization"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "A Directed Acyclic Graph (DAG) representation of a basic block is primarily used for:",
      options: [
        { id: "A", text: "Detecting loop invariants" },
        { id: "B", text: "Eliminating common subexpressions within the basic block" },
        { id: "C", text: "Register allocation" },
        { id: "D", text: "Tokenization" },
      ],
      correct_answer: "B",
      explanation: "In a basic block DAG, shared subexpressions share node pointers, immediately identifying and eliminating local common subexpressions.",
      exam_name: "GATE CS",
      exam_year: 2023,
    },
    {
      id: "10000000-0000-0000-0001-000000000009",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Code Generation & Optimization"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "Three-address code (TAC) instructions contain at most how many memory addresses or variables?",
      options: [
        { id: "A", text: "Two" },
        { id: "B", text: "Three" },
        { id: "C", text: "Four" },
        { id: "D", text: "Unlimited" },
      ],
      correct_answer: "B",
      explanation: "Three-address code statements are of the general form x = y op z, utilizing at most three addresses (two operands and one result).",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0001-000000000010",
      subject_id: getSubjectId("Compiler Design"),
      chapter_id: getChapterId("Compiler Design", "Code Generation & Optimization"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.HARD,
      question_text: "Moving code outside a loop that computes the same value in every iteration is called:",
      options: [
        { id: "A", text: "Strength Reduction" },
        { id: "B", text: "Loop Unrolling" },
        { id: "C", text: "Code Motion (Loop-Invariant Code Motion)" },
        { id: "D", text: "Dead Code Elimination" },
      ],
      correct_answer: "C",
      explanation: "Code motion hoists statements whose evaluations remain unchanged across all loop iterations to the preheader of the loop.",
      exam_name: "ISRO CS",
      exam_year: 2020,
    },

    // ==========================================
    // OPERATING SYSTEMS (10 questions: 5 Concept, 5 PYQ)
    // ==========================================
    {
      id: "10000000-0000-0000-0002-000000000001",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Processes & CPU Scheduling"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "Which state transition occurs when an I/O operation requested by a running process completes?",
      options: [
        { id: "A", text: "Waiting to Ready" },
        { id: "B", text: "Running to Ready" },
        { id: "C", text: "Ready to Running" },
        { id: "D", text: "Waiting to Running" },
      ],
      correct_answer: "A",
      explanation: "When an I/O event finishes, the blocked/waiting process transitions to the Ready queue to await CPU allocation.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0002-000000000002",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Processes & CPU Scheduling"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "Which CPU scheduling algorithm suffers from the Convoy Effect?",
      options: [
        { id: "A", text: "Round Robin" },
        { id: "B", text: "Shortest Job First" },
        { id: "C", text: "First-Come, First-Served (FCFS)" },
        { id: "D", text: "Priority Scheduling" },
      ],
      correct_answer: "C",
      explanation: "In FCFS, when a long CPU-bound process holds the CPU, short I/O-bound processes queue behind it, resulting in the Convoy Effect.",
      exam_name: "GATE CS",
      exam_year: 2022,
    },
    {
      id: "10000000-0000-0000-0002-000000000003",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Processes & CPU Scheduling"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "In multithreaded systems, what resource is typically private to each thread?",
      options: [
        { id: "A", text: "Global variables" },
        { id: "B", text: "Heap memory" },
        { id: "C", text: "Stack and registers" },
        { id: "D", text: "Open file descriptors" },
      ],
      correct_answer: "C",
      explanation: "Threads of the same process share code, data, heap, and open files, but maintain individual program counters, register sets, and call stacks.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0002-000000000004",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Memory Management & Paging"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "What hardware component accelerates virtual address translation in a paged memory system?",
      options: [
        { id: "A", text: "ALU" },
        { id: "B", text: "Translation Lookaside Buffer (TLB)" },
        { id: "C", text: "DMA Controller" },
        { id: "D", text: "Instruction Register" },
      ],
      correct_answer: "B",
      explanation: "A TLB is a high-speed associative hardware cache that stores recent virtual-to-physical page frame translations.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0002-000000000005",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Memory Management & Paging"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "Belady's Anomaly occurs in which of the following page replacement algorithms?",
      options: [
        { id: "A", text: "LRU (Least Recently Used)" },
        { id: "B", text: "Optimal Page Replacement" },
        { id: "C", text: "FIFO (First-In, First-Out)" },
        { id: "D", text: "MRU (Most Recently Used)" },
      ],
      correct_answer: "C",
      explanation: "In FIFO, increasing the number of allocated physical frames can paradoxically increase the total number of page faults.",
      exam_name: "GATE CS",
      exam_year: 2021,
    },
    {
      id: "10000000-0000-0000-0002-000000000006",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Memory Management & Paging"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.HARD,
      question_text: "Thrashing occurs in an operating system when:",
      options: [
        { id: "A", text: "The CPU spends more time paging than executing processes" },
        { id: "B", text: "Multiple deadlocked processes are terminated simultaneously" },
        { id: "C", text: "Disk read errors exceed parity thresholds" },
        { id: "D", text: "Processes enter infinite loop constructs" },
      ],
      correct_answer: "A",
      explanation: "Thrashing happens when the sum of working set sizes of all active processes exceeds physical RAM, causing continuous page faults.",
      exam_name: "GATE CS",
      exam_year: 2023,
    },
    {
      id: "10000000-0000-0000-0002-000000000007",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Deadlocks & Synchronization"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "Which of the following is NOT one of the four Coffman conditions necessary for deadlock?",
      options: [
        { id: "A", text: "Mutual Exclusion" },
        { id: "B", text: "Hold and Wait" },
        { id: "C", text: "Preemption Allowed" },
        { id: "D", text: "Circular Wait" },
      ],
      correct_answer: "C",
      explanation: "Deadlock requires No Preemption (resources cannot be forcibly reclaimed), Mutual Exclusion, Hold and Wait, and Circular Wait.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0002-000000000008",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Deadlocks & Synchronization"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "Banker's algorithm is used in an operating system for:",
      options: [
        { id: "A", text: "Deadlock Prevention" },
        { id: "B", text: "Deadlock Avoidance" },
        { id: "C", text: "Deadlock Detection" },
        { id: "D", text: "Deadlock Recovery" },
      ],
      correct_answer: "B",
      explanation: "Banker's algorithm inspects resource allocation requests to ensure the system remains in a safe state, thereby avoiding deadlock.",
      exam_name: "GATE CS",
      exam_year: 2020,
    },
    {
      id: "10000000-0000-0000-0002-000000000009",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Deadlocks & Synchronization"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "A counting semaphore initialized to 10 has 6 P (wait) operations and 2 V (signal) operations performed on it. What is the final value?",
      options: [
        { id: "A", text: "4" },
        { id: "B", text: "6" },
        { id: "C", text: "8" },
        { id: "D", text: "2" },
      ],
      correct_answer: "B",
      explanation: "Final value = Initial (10) - Wait (6) + Signal (2) = 6.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0002-000000000010",
      subject_id: getSubjectId("Operating Systems"),
      chapter_id: getChapterId("Operating Systems", "Deadlocks & Synchronization"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.HARD,
      question_text: "The Peterson solution for critical section synchronization solves the problem for how many processes?",
      options: [
        { id: "A", text: "1 process" },
        { id: "B", text: "2 processes" },
        { id: "C", text: "N processes" },
        { id: "D", text: "Unlimited processes" },
      ],
      correct_answer: "B",
      explanation: "Peterson's algorithm is a software-based critical section solution guaranteed to satisfy mutual exclusion, progress, and bounded waiting for 2 processes.",
      exam_name: "ISRO CS",
      exam_year: 2021,
    },

    // ==========================================
    // DBMS (10 questions: 5 Concept, 5 PYQ)
    // ==========================================
    {
      id: "10000000-0000-0000-0003-000000000001",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "Relational Model & ER Diagrams"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "In an ER diagram, a double rectangle represents which of the following?",
      options: [
        { id: "A", text: "Weak Entity Set" },
        { id: "B", text: "Multivalued Attribute" },
        { id: "C", text: "Identifying Relationship" },
        { id: "D", text: "Derived Attribute" },
      ],
      correct_answer: "A",
      explanation: "In standard ER notation, weak entity sets that lack a primary key of their own are represented by double rectangles.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0003-000000000002",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "Relational Model & ER Diagrams"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "A superkey that contains no extraneous attributes is known as a:",
      options: [
        { id: "A", text: "Foreign Key" },
        { id: "B", text: "Candidate Key" },
        { id: "C", text: "Secondary Key" },
        { id: "D", text: "Alternate Key" },
      ],
      correct_answer: "B",
      explanation: "A candidate key is a minimal superkey; removal of any attribute from it breaks the uniqueness property.",
      exam_name: "GATE CS",
      exam_year: 2022,
    },
    {
      id: "10000000-0000-0000-0003-000000000003",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "Relational Model & ER Diagrams"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "Referential integrity constraint in relational databases is enforced using:",
      options: [
        { id: "A", text: "Primary Key" },
        { id: "B", text: "Foreign Key" },
        { id: "C", text: "Unique Key" },
        { id: "D", text: "Check Constraint" },
      ],
      correct_answer: "B",
      explanation: "Foreign key constraints ensure that values in a referencing table match values in the referenced primary key column or are null.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0003-000000000004",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "SQL & Relational Algebra"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "Which relational algebra operation selects rows that satisfy a specified predicate?",
      options: [
        { id: "A", text: "Projection (π)" },
        { id: "B", text: "Selection (σ)" },
        { id: "C", text: "Cartesian Product (×)" },
        { id: "D", text: "Join (⋈)" },
      ],
      correct_answer: "B",
      explanation: "The selection operator (sigma, σ) acts as a horizontal filter selecting tuples satisfying condition P.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0003-000000000005",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "SQL & Relational Algebra"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "A relation R is in Boyce-Codd Normal Form (BCNF) if for every functional dependency X -> Y:",
      options: [
        { id: "A", text: "Y is a prime attribute" },
        { id: "B", text: "X is a superkey" },
        { id: "C", text: "X is a subset of Y" },
        { id: "D", text: "Y is a superkey" },
      ],
      correct_answer: "B",
      explanation: "BCNF requires that for every non-trivial functional dependency X -> Y, the determinant X must be a superkey of the relation.",
      exam_name: "GATE CS",
      exam_year: 2021,
    },
    {
      id: "10000000-0000-0000-0003-000000000006",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "SQL & Relational Algebra"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.HARD,
      question_text: "Which of the following relational algebra operators is NOT a fundamental (primitive) operator?",
      options: [
        { id: "A", text: "Selection" },
        { id: "B", text: "Projection" },
        { id: "C", text: "Natural Join" },
        { id: "D", text: "Set Difference" },
      ],
      correct_answer: "C",
      explanation: "Natural Join is a derived operator defined through the composition of Cartesian Product, Selection, and Projection.",
      exam_name: "GATE CS",
      exam_year: 2023,
    },
    {
      id: "10000000-0000-0000-0003-000000000007",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "Transactions & Concurrency Control"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.EASY,
      question_text: "The 'All or Nothing' property of transactions is known as:",
      options: [
        { id: "A", text: "Atomicity" },
        { id: "B", text: "Consistency" },
        { id: "C", text: "Isolation" },
        { id: "D", text: "Durability" },
      ],
      correct_answer: "A",
      explanation: "Atomicity guarantees that either all operations of the transaction complete successfully, or the database is returned to its pre-transaction state.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0003-000000000008",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "Transactions & Concurrency Control"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "Conflict serializability of a schedule can be verified by checking if the precedence graph (serialization graph):",
      options: [
        { id: "A", text: "Has a cycle" },
        { id: "B", text: "Is acyclic" },
        { id: "C", text: "Is strongly connected" },
        { id: "D", text: "Has multiple connected components" },
      ],
      correct_answer: "B",
      explanation: "A schedule S is conflict serializable if and only if its precedence graph has no cycles (is a directed acyclic graph).",
      exam_name: "GATE CS",
      exam_year: 2020,
    },
    {
      id: "10000000-0000-0000-0003-000000000009",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "Transactions & Concurrency Control"),
      question_type: QuestionType.CONCEPT,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.MEDIUM,
      question_text: "In the Two-Phase Locking (2PL) protocol, what is true about the shrinking phase?",
      options: [
        { id: "A", text: "Transactions may acquire new locks" },
        { id: "B", text: "Transactions can only release locks and cannot acquire any new locks" },
        { id: "C", text: "Deadlocks cannot occur" },
        { id: "D", text: "Cascading aborts are permanently prevented" },
      ],
      correct_answer: "B",
      explanation: "Once a transaction releases any lock, it enters the shrinking phase and is strictly forbidden from requesting new locks.",
      exam_name: null,
      exam_year: null,
    },
    {
      id: "10000000-0000-0000-0003-000000000010",
      subject_id: getSubjectId("DBMS"),
      chapter_id: getChapterId("DBMS", "Transactions & Concurrency Control"),
      question_type: QuestionType.PYQ,
      source: QuestionSource.MANUAL,
      difficulty: Difficulty.HARD,
      question_text: "Which lock type permits concurrent read access by multiple transactions but prohibits concurrent writes?",
      options: [
        { id: "A", text: "Exclusive lock (X)" },
        { id: "B", text: "Shared lock (S)" },
        { id: "C", text: "Intent exclusive lock (IX)" },
        { id: "D", text: "Update lock (U)" },
      ],
      correct_answer: "B",
      explanation: "A Shared Lock (S) allows multiple transactions to read a resource simultaneously; no transaction may write until all shared locks are released.",
      exam_name: "ISRO CS",
      exam_year: 2022,
    },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        subject_id: q.subject_id,
        chapter_id: q.chapter_id,
        question_type: q.question_type,
        source: q.source,
        difficulty: q.difficulty,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        exam_name: q.exam_name,
        exam_year: q.exam_year,
        status: QuestionStatus.ACTIVE,
      },
      create: {
        id: q.id,
        subject_id: q.subject_id,
        chapter_id: q.chapter_id,
        question_type: q.question_type,
        source: q.source,
        difficulty: q.difficulty,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        exam_name: q.exam_name,
        exam_year: q.exam_year,
        status: QuestionStatus.ACTIVE,
        created_by: admin.id,
      },
    });
  }

  console.log(`✅ Seeded ${questions.length} questions across all subjects.`);
  console.log("🚀 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
