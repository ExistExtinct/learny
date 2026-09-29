const LEVELS = [
  { name: 'Beginner', count: 20 },
  { name: 'Moderate', count: 20 },
  { name: 'Advanced', count: 20 }
];

const TOPICS = {
  javascript: ['syntax and expressions', 'variables and scope', 'primitive values', 'operators', 'conditionals', 'loops', 'arrays', 'objects', 'destructuring', 'functions', 'closures', 'array transformations', 'modules', 'errors', 'DOM events', 'forms and validation', 'browser storage', 'promises', 'async workflows', 'testing and performance'],
  html: ['document structure', 'headings and text', 'links and navigation', 'images and media', 'lists and tables', 'semantic landmarks', 'forms', 'labels and validation', 'accessible names', 'metadata and SEO', 'responsive images', 'embedded content', 'templates', 'web components', 'content models', 'ARIA patterns', 'performance hints', 'security attributes', 'design systems', 'accessible page architecture'],
  css: ['selectors', 'the cascade', 'box model', 'colors and units', 'typography', 'spacing', 'display', 'positioning', 'flexbox', 'grid', 'responsive breakpoints', 'media queries', 'transitions', 'transforms', 'animations', 'custom properties', 'layers and nesting', 'container queries', 'component architecture', 'performance and accessibility'],
  python: ['syntax and expressions', 'variables and types', 'conditionals', 'loops', 'strings', 'lists', 'dictionaries', 'sets and tuples', 'functions', 'modules', 'exceptions', 'files', 'comprehensions', 'iterators', 'classes', 'dataclasses', 'testing', 'concurrency', ' APIs and data', 'performance and packaging'],
  nodejs: ['runtime fundamentals', 'modules', 'npm and scripts', 'file paths', 'HTTP servers', 'routing', 'JSON APIs', 'middleware', 'validation', 'authentication', 'sessions', 'databases', 'async I/O', 'streams', 'workers', 'testing', 'logging', 'caching', 'deployment', 'security architecture'],
  'web-fundamentals': ['the browser', 'URLs and DNS', 'HTTP requests', 'responses and status codes', 'headers', 'cookies', 'caching', 'HTML parsing', 'CSS and layout', 'JavaScript execution', 'the DOM', 'events', 'forms', 'APIs', 'CORS', 'accessibility', 'performance', 'security', 'testing', 'production delivery'],
  typescript: ['type inference', 'primitive types', 'arrays and tuples', 'objects', 'unions', 'intersections', 'interfaces', 'functions', 'generics', 'narrowing', 'utility types', 'modules', 'classes', 'declaration files', 'async types', 'React props', 'API contracts', 'configuration', 'testing', 'large-scale architecture'],
  react: ['components', 'JSX', 'props', 'state', 'events', 'conditional UI', 'lists and keys', 'forms', 'effects', 'refs', 'custom hooks', 'context', 'reducers', 'data fetching', 'routing', 'performance', 'testing', 'accessibility', 'server rendering', 'application architecture'],
  sql: ['tables and rows', 'SELECT', 'filtering', 'ordering', 'aggregation', 'GROUP BY', 'joins', 'subqueries', 'constraints', 'normalization', 'indexes', 'transactions', 'views', 'window functions', 'CTEs', 'query plans', 'security', 'migrations', 'reporting', 'production data design'],
  git: ['repositories', 'working tree', 'staging', 'commits', 'history', 'branches', 'merging', 'rebasing', 'remotes', 'pull requests', 'reviews', 'conflicts', 'tags', 'release flow', 'hooks', 'automation', 'monorepos', 'recovery', 'team conventions', 'delivery architecture'],
  'ai-engineering': ['AI concepts', 'prompt structure', 'context', 'examples', 'output formats', 'hallucination checks', 'code assistance', 'study workflows', 'tool selection', 'API calls', 'streaming', 'structured output', 'embeddings', 'retrieval', 'evaluation', 'privacy', 'safety', 'observability', 'cost control', 'production architecture']
};

const PROJECT_KINDS = ['flashcard', 'calculator', 'tracker', 'dashboard', 'search tool', 'form workflow', 'quiz', 'CLI utility', 'data explorer', 'API client', 'content manager', 'automation', 'accessibility audit', 'performance report', 'team workflow', 'portfolio piece', 'capstone', 'refactor exercise', 'test suite', 'production-ready feature'];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function lessonContent(course, topic, level, index) {
  const focus = `${course.title} concept: ${topic}`;
  return [
    `## ${focus}\n\nThis lesson builds a dependable mental model for ${topic} at the ${level.toLowerCase()} level. Do not treat the syntax as a collection of tricks. Start by identifying the problem the feature solves, the data that enters it, the transformation that happens, and the result a user or another part of the program can observe. That habit makes the idea transferable to new projects and helps you debug when an example is not identical to the one in the lesson.`,
    `### The core idea\n\nIn ${course.title}, ${topic} sits between a clear intention and an observable outcome. Name the inputs, define the rules, and make the boundary explicit. Beginners should first make one small example work, then change one variable and predict the result before running it. At the ${level.toLowerCase()} stage, also consider maintainability: a useful solution is readable, testable, and honest about failure. Prefer a few well-named steps over compressed code that hides assumptions.`,
    `### A worked example\n\nImagine a learner building a small ${PROJECT_KINDS[index % PROJECT_KINDS.length]} around ${topic}. The first version should use a tiny dataset and a visible result. For example, create a value called \`sample\`, apply the ${topic} operation, and display both the input and output. Then add a second case that is empty, incomplete, or unexpectedly large. If the behavior changes, document why. This is how a toy example becomes engineering practice: every line has a purpose, and every edge case teaches a boundary.`,
    `### A practical workflow\n\n1. State the desired behavior in one sentence.\n2. Write the smallest input that proves the sentence.\n3. Implement the happy path with names that explain intent.\n4. Add an invalid or empty input and decide whether to reject, ignore, or recover.\n5. Test the result manually, then turn the important cases into automated checks.\n6. Refactor only after the behavior is correct.\n\nFor a ${level.toLowerCase()} learner, the last step matters. Advanced work is not merely adding more features; it is reducing accidental complexity and making future changes safer.`,
    `### Common mistakes and trade-offs\n\nWatch for hidden state, implicit conversions, duplicated logic, unvalidated input, and examples that only work for one hard-coded value. Ask whether the code is coupled to a particular screen, file name, database shape, or response order. When there are two reasonable approaches, compare clarity, runtime cost, accessibility, security, and ease of testing. Explain the trade-off in a short note. A future teammate should be able to understand not only what you chose, but also which constraint made that choice sensible.`,
    `### Guided practice\n\nComplete the projects below in order. The first project checks vocabulary and basic control flow. The middle projects combine ${topic} with another concept from the course. The final projects ask you to design boundaries, test failure modes, and explain your decisions. Keep a short development log: record your initial prediction, the result you observed, the bug you found, and the change that fixed it. That log is valuable evidence of learning and gives the AI Tutor useful context when you ask for feedback.`,
    `### Recap\n\nYou should now be able to explain what ${topic} is for, identify its inputs and outputs, build a small working example, and choose a safer design when requirements change. Before marking this lesson complete, teach the idea back in your own words and complete at least one project without copying the worked example. Then revisit the harder project after a break. Spaced repetition, deliberate edge cases, and a finished artifact will build stronger intuition than memorizing a definition.`,
  ].join('\n\n');
}

function projectRows(course, lesson) {
  return PROJECT_KINDS.map((kind, index) => ({
    title: `${course.title} ${kind}: ${lesson.title}`,
    difficulty: index < 6 ? 'Starter' : index < 13 ? 'Builder' : index < 18 ? 'Advanced' : 'Capstone',
    description: `Build a ${kind} that makes ${lesson.title.toLowerCase()} visible through a useful ${course.title} workflow. Start with a small, local example, then add validation, an empty state, and a short README explaining your decisions.`,
    requirements: [
      `Demonstrate ${lesson.title.toLowerCase()} with at least three realistic inputs.`,
      'Handle empty, invalid, and repeated input without crashing.',
      'Include a short test checklist and one improvement you would make next.'
    ].join(' ')
  }));
}

async function insertMany(db, table, columns, rows, conflict = '') {
  if (!rows.length) return;
  const values = [];
  const tuples = rows.map(row => {
    const start = values.length;
    values.push(...row);
    return `(${row.map((_, index) => `$${start + index + 1}`).join(',')})`;
  });
  await db.query(`INSERT INTO ${table}(${columns}) VALUES ${tuples.join(',')} ${conflict}`, values);
}

export async function ensureCurriculum(db) {
  const courses = await db.query('SELECT * FROM courses ORDER BY id');
  for (const course of courses) {
    const topics = TOPICS[course.slug] || TOPICS['web-fundamentals'];
    const existingCounts = Object.fromEntries((await db.query(
      'SELECT level, COUNT(*) AS count FROM lessons WHERE course_id=$1 GROUP BY level', [course.id]
    )).map(row => [row.level, Number(row.count)]));
    const maxRow = (await db.query('SELECT COALESCE(MAX(order_no), 0) AS max_order FROM lessons WHERE course_id=$1', [course.id]))[0];
    let nextOrder = Number(maxRow.max_order);
    const newLessons = [];
    LEVELS.forEach(({ name: level }, levelIndex) => {
      const needed = Math.max(0, 20 - (existingCounts[level] || 0));
      for (let i = 0; i < needed; i += 1) {
        const topic = topics[(levelIndex * 6 + i) % topics.length];
        const title = `${topic[0].toUpperCase()}${topic.slice(1)} ${level} Workshop`;
        const lessonSlug = `${course.slug}-${slug(level)}-${String(i + 1).padStart(2, '0')}-${slug(topic)}`;
        nextOrder += 1;
        newLessons.push([
          course.id, lessonSlug, title,
          `Learn ${topic} through a guided ${level.toLowerCase()} project.`,
          lessonContent(course, topic, level, levelIndex * 20 + i),
          nextOrder, 20 + levelIndex * 5, level,
          `Explain ${topic}, apply it in a small example, and test an edge case.`,
          `// Build a small ${course.title} example using ${topic}`,
          `Create a working example of ${topic}, then describe one edge case and how your solution handles it.`
        ]);
      }
    });
    await insertMany(db, 'lessons',
      'course_id,slug,title,summary,content,order_no,xp,level,objectives,example,practice_prompt',
      newLessons, 'ON CONFLICT(slug) DO NOTHING');

    const lessons = await db.query('SELECT id, title FROM lessons WHERE course_id=$1 ORDER BY order_no', [course.id]);
    const projectRowsToInsert = [];
    for (const lesson of lessons) {
      const projects = projectRows(course, lesson);
      for (const [index, project] of projects.entries()) {
        projectRowsToInsert.push([
          lesson.id, project.title, project.difficulty,
          project.description, project.requirements, index + 1
        ]);
      }
    }
    await insertMany(db, 'lesson_projects',
      'lesson_id,title,difficulty,description,requirements,order_no',
      projectRowsToInsert, 'ON CONFLICT(lesson_id,order_no) DO NOTHING');
  }
}

export async function ensurePracticeCatalog(db) {
  const courses = await db.query('SELECT id, slug, title FROM courses ORDER BY id');
  const topics = [
    'a greeting formatter', 'a score calculator', 'a word counter', 'a temperature converter',
    'a shopping total', 'a palindrome checker', 'a password strength meter',
    'a reading list', 'a quiz result tracker', 'a budget summary', 'a contact form',
    'a responsive card', 'a navigation menu', 'a product filter', 'a modal dialog',
    'a searchable table', 'a progress dashboard', 'a habit tracker', 'a notes widget',
    'a small API client'
  ];
  const difficulty = (index) => index < 34 ? 'Easy' : index < 68 ? 'Medium' : 'Hard';
  const fileSet = (course, index) => {
    if (course.slug === 'html' && index % 4 === 0) {
      return [
        { path: 'index.html', content: '<main><h1>Build this page</h1></main>' },
        { path: 'style.css', content: 'main { font-family: system-ui; }' },
        { path: 'script.js', content: 'console.log("Connect this page");' }
      ];
    }
    if (course.slug === 'python') return [{ path: 'main.py', content: 'def solve(value):\n    # write your solution\n    return value\n\nprint(solve("Learny"))' }];
    if (course.slug === 'sql') return [{ path: 'query.sql', content: '-- write your query here\nSELECT 1;' }];
    return [{ path: 'script.js', content: 'function solve(value) {\n  // write your solution\n}\n\nconsole.log(solve("Learny"));' }];
  };
  const practiceRows = [];
  for (let index = 0; index < 100; index += 1) {
    const course = courses[index % courses.length];
    const topic = topics[index % topics.length];
    const files = fileSet(course, index);
    const title = `Practice ${String(index + 1).padStart(3, '0')}: ${topic}`;
    const description = `Build ${topic}. Your solution should accept the stated input, produce a predictable result, and communicate invalid input clearly. Validate the normal case, empty input, unexpected values, and repeated use. Keep the implementation readable and explain one design decision.`;
    const expected = `Expected output: a correct ${topic} result for valid input; a safe, intentional response for empty or invalid input; and no uncaught errors when the operation is repeated.`;
    practiceRows.push([
      course.id,
      title,
      description,
      files[0].content,
      expected,
      difficulty(index),
      JSON.stringify(files),
    ]);
  }
  await insertMany(db, 'challenges',
    'course_id,title,description,starter_code,expected,difficulty,files',
    practiceRows,
    `ON CONFLICT DO NOTHING`);
}
