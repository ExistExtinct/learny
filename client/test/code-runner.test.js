import test from "node:test";
import assert from "node:assert/strict";
import { buildWebPreview, formatPredictedTerminal } from "../src/code-runner.js";

test("web previews combine project files and capture browser console output", () => {
  const preview = buildWebPreview([
    { path: "index.html", content: '<main id="app">Hello</main>' },
    { path: "style.css", content: "#app { color: red; }" },
    { path: "script.js", content: 'console.log("ready");' },
  ]);

  assert.match(preview, /Content-Security-Policy/);
  assert.match(preview, /default-src 'none'/);
  assert.match(preview, /#app \{ color: red; \}/);
  assert.match(preview, /learny-preview-console/);
  assert.match(preview, /console\.log\("ready"\)/);
});

test("full HTML documents receive sandbox assets without nested document wrappers", () => {
  const preview = buildWebPreview([
    { path: "index.html", content: "<!doctype html><html><head></head><body>Hello</body></html>" },
    { path: "script.js", content: 'console.log("</script>");' },
  ]);

  assert.equal((preview.match(/<html\b/gi) || []).length, 1);
  assert.match(preview, /<body>Hello<script>/);
  assert.match(preview, /console\.log\("<\\\/script>"\)/);
});

test("locally linked project assets are bundled once into the preview", () => {
  const preview = buildWebPreview([
    {
      path: "index.html",
      content: '<link rel="stylesheet" href="./style.css"><script src="script.js"></script><main>Ready</main>',
    },
    { path: "style.css", content: "main { color: red; }" },
    { path: "script.js", content: 'console.log("once");' },
  ]);

  assert.doesNotMatch(preview, /href="\.\/style\.css"/);
  assert.doesNotMatch(preview, /src="script\.js"/);
  assert.equal((preview.match(/main \{ color: red; \}/g) || []).length, 1);
  assert.equal((preview.match(/console\.log\("once"\)/g) || []).length, 1);
});

test("predicted output uses shell formatting without exposing AI explanation text", () => {
  assert.equal(
    formatPredictedTerminal(
      { stdout: "Hello\n", stderr: "", exitCode: 0 },
      "python",
    ),
    "$ python main.py\nHello\n\nProcess exited with code 0.",
  );
});

test("predicted output marks an unknown process status", () => {
  assert.equal(
    formatPredictedTerminal(
      { stdout: "", stderr: "Syntax error", exitCode: null },
      "ruby",
    ),
    "$ ruby main.rb\nSyntax error\nProcess status unknown.",
  );
});
