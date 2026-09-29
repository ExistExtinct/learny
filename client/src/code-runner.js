const previewBridge = `(() => {
  const send = (level, message) => {
    window.parent.postMessage(
      { type: "learny-preview-console", level, message: String(message).slice(0, 5000) },
      "*",
    );
  };
  const format = (value) => {
    if (typeof value === "string") return value;
    try {
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch {
      return String(value);
    }
  };
  for (const level of ["log", "info", "warn", "error"]) {
    const original = console[level].bind(console);
    console[level] = (...values) => {
      original(...values);
      send(level, values.map(format).join(" "));
    };
  }
  window.addEventListener("error", (event) => {
    send("error", event.message || "Uncaught script error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    send("error", format(event.reason));
  });
})();`;

const escapeScript = (source) => source.replace(/<\/script/gi, "<\\/script");
const escapeStyle = (source) => source.replace(/<\/style/gi, "<\\/style");

function resolveLocalAsset(htmlFile, url) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) return null;
  const relativePath = url.split(/[?#]/, 1)[0].replace(/^\/+/, "");
  const base = url.startsWith("/") ? [] : (htmlFile || "").split("/").slice(0, -1);
  for (const segment of relativePath.split("/")) {
    if (segment === "..") {
      if (!base.length) return null;
      base.pop();
    } else if (segment && segment !== ".") {
      base.push(segment);
    }
  }
  return base.join("/").toLowerCase();
}

function stripBundledAssetTags(html, files, htmlFile) {
  const bundledFiles = new Set(files.map((file) => file.path.toLowerCase()));
  return html
    .replace(/<link\b[^>]*>/gi, (tag) => {
      const href = tag.match(
        /\bhref\s*=\s*["']([^"']+\.css)(?:[?#][^"']*)?["']/i,
      )?.[1];
      const localPath = href && resolveLocalAsset(htmlFile, href);
      return localPath && bundledFiles.has(localPath) ? "" : tag;
    })
    .replace(
      /<script\b[^>]*\bsrc\s*=\s*["']([^"']+\.(?:js|jsx|mjs|cjs))(?:[?#][^"']*)?["'][^>]*>\s*<\/script\s*>/gi,
      (tag, url) => {
        const localPath = resolveLocalAsset(htmlFile, url);
        return localPath && bundledFiles.has(localPath) ? "" : tag;
      },
    );
}

export function buildWebPreview(files) {
  const source = Object.fromEntries(files.map((file) => [file.path, file.content]));
  const htmlFile =
    Object.keys(source).find((name) => /^(index|main)\.html?$/i.test(name)) ||
    Object.keys(source).find((name) => /\.html?$/i.test(name));
  const html = stripBundledAssetTags(source[htmlFile] || "", files, htmlFile);
  const styles = Object.entries(source)
    .filter(([name]) => /\.css$/i.test(name))
    .map(([, content]) => content)
    .join("\n");
  const scripts = Object.entries(source)
    .filter(([name]) => /\.(js|jsx|mjs|cjs)$/i.test(name))
    .map(([, content]) => content)
    .join("\n");
  const csp =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:\">";
  const headAssets = `${csp}<style>${escapeStyle(styles)}</style><script>${escapeScript(previewBridge)}<\/script>`;
  const appScript = scripts
    ? `<script>${escapeScript(scripts)}<\/script>`
    : "";

  if (/<html\b/i.test(html)) {
    let document = html;
    if (/<head\b[^>]*>/i.test(document)) {
      document = document.replace(/<head\b[^>]*>/i, (head) => `${head}${headAssets}`);
    } else {
      document = document.replace(
        /<html\b[^>]*>/i,
        (openHtml) => `${openHtml}<head>${headAssets}</head>`,
      );
    }
    if (appScript) {
      if (/<\/body\s*>/i.test(document)) {
        document = document.replace(/<\/body\s*>/i, `${appScript}</body>`);
      } else if (/<\/html\s*>/i.test(document)) {
        document = document.replace(/<\/html\s*>/i, `${appScript}</html>`);
      } else {
        document += appScript;
      }
    }
    return document;
  }

  return `<!doctype html><html><head><meta charset="UTF-8">${headAssets}</head><body>${html}${appScript}</body></html>`;
}

const terminalCommands = {
  python: "python main.py",
  ruby: "ruby main.rb",
  go: "go run main.go",
  rust: "rustc main.rs -o program && ./program",
  java: "javac Main.java && java Main",
  c: "gcc main.c -o program && ./program",
  cpp: "g++ main.cpp -o program && ./program",
};

export function formatPredictedTerminal({ stdout, stderr, exitCode }, language) {
  const command = terminalCommands[language] || language;
  const lines = [`$ ${command}`];
  const output = [stdout, stderr].filter(Boolean).join(stdout && stderr ? "\n" : "");
  lines.push(output || "Process completed without output.");
  if (Number.isInteger(exitCode)) {
    lines.push(`Process exited with code ${exitCode}.`);
  } else {
    lines.push("Process status unknown.");
  }
  return lines.join("\n");
}
