import { spawn } from 'node:child_process';

const MAX_FILE_SIZE = 100 * 1024;
const MAX_TOTAL_SIZE = 500 * 1024;
const MAX_FILES = 20;
const MAX_STDIN_SIZE = 100 * 1024;
const MAX_OUTPUT_SIZE = 200 * 1024;
const EXECUTION_TIMEOUT_MS = 8_000;

const LANGUAGES = {
  python: { image: 'python:3.12-alpine', command: ['python', '/workspace/main.py'], filename: 'main.py' },
  py: { image: 'python:3.12-alpine', command: ['python', '/workspace/main.py'], filename: 'main.py' },
  javascript: { image: 'node:22-alpine', command: ['node', '/workspace/main.js'], filename: 'main.js' },
  js: { image: 'node:22-alpine', command: ['node', '/workspace/main.js'], filename: 'main.js' },
  node: { image: 'node:22-alpine', command: ['node', '/workspace/main.js'], filename: 'main.js' },
  ruby: { image: 'ruby:3.3-alpine', command: ['ruby', '/workspace/main.rb'], filename: 'main.rb' },
  go: { image: 'golang:1.23-alpine', command: ['go', 'run', '/workspace/main.go'], filename: 'main.go' },
  rust: { image: 'rust:1.81-alpine', command: ['sh', '-c', 'rustc /workspace/main.rs -o /workspace/program && /workspace/program'], filename: 'main.rs' },
  java: { image: 'eclipse-temurin:21-jdk-alpine', command: ['sh', '-c', 'javac /workspace/Main.java && java -cp /workspace Main'], filename: 'Main.java' },
  c: { image: 'gcc:14', command: ['sh', '-c', 'gcc /workspace/main.c -o /workspace/program && /workspace/program'], filename: 'main.c' },
  cpp: { image: 'gcc:14', command: ['sh', '-c', 'g++ /workspace/main.cpp -o /workspace/program && /workspace/program'], filename: 'main.cpp' }
};

function fail(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function validatePath(filePath) {
  if (typeof filePath !== 'string' || !filePath || filePath.length > 100 ||
      filePath.startsWith('/') || filePath.includes('\\') || filePath.includes('\0') ||
      filePath.split('/').some(part => !part || part === '.' || part === '..')) {
    throw fail('Invalid file path');
  }
}

function normalizeRequest(input) {
  if (!input || typeof input !== 'object' || typeof input.language !== 'string') throw fail('Language is required');
  const language = input.language.trim().toLowerCase();
  const spec = LANGUAGES[language];
  if (!spec) throw fail('Unsupported language');
  if (typeof input.stdin !== 'string' || Buffer.byteLength(input.stdin, 'utf8') > MAX_STDIN_SIZE) throw fail('stdin is too large');
  const rawFiles = Array.isArray(input.files)
    ? input.files
    : (input.files && typeof input.files === 'object'
      ? Object.entries(input.files).map(([path, content]) => ({ path, content })) : []);
  if (rawFiles.length > MAX_FILES) throw fail('Too many files');
  const files = rawFiles.map(file => {
    if (!file || typeof file !== 'object') throw fail('Invalid file');
    validatePath(file.path);
    if (typeof file.content !== 'string' || Buffer.byteLength(file.content, 'utf8') > MAX_FILE_SIZE) throw fail('File is too large');
    return { path: file.path, content: file.content };
  });
  if (!files.some(file => file.path === spec.filename)) {
    if (files.length === 0) files.push({ path: spec.filename, content: '' });
    else throw fail(`A ${spec.filename} file is required`);
  }
  const total = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, 'utf8'), Buffer.byteLength(input.stdin, 'utf8'));
  if (total > MAX_TOTAL_SIZE) throw fail('Input is too large');
  return { spec, files, stdin: input.stdin };
}

// A small POSIX ustar writer avoids invoking any host-side archive or shell command.
function tarEntry(name, content) {
  const data = Buffer.from(content, 'utf8');
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  const padding = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header, data, padding]);
}

function makeArchive(files, stdin) {
  return Buffer.concat([...files.map(file => tarEntry(file.path, file.content)), tarEntry('.stdin', stdin), Buffer.alloc(1024)]);
}

export function checkDocker() {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(fail('Docker is unavailable. Start Docker and try again.', 503)); }, 4_000);
    child.on('error', error => { clearTimeout(timer); reject(error.code === 'ENOENT' ? fail('Docker is unavailable. Install and start Docker, then try again.', 503) : error); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('exit', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(fail(`Docker is unavailable${stderr.trim() ? `: ${stderr.trim().slice(0, 200)}` : '. Start Docker and try again.'}`, 503));
    });
  });
}

export async function executeCode(input) {
  const { spec, files, stdin } = normalizeRequest(input);
  await checkDocker();
  const args = [
    'run', '--rm', '-i', '--network', 'none', '--read-only',
    '--tmpfs', '/workspace:rw,nosuid,nodev,size=64m',
    '--cpus', '0.5', '--memory', '128m', '--pids-limit', '64',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', '65532:65532',
    spec.image, 'sh', '-c',
    `tar -xf - -C /workspace && exec ${spec.command.map(arg => /^[A-Za-z0-9_./:-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`).join(' ')} < /workspace/.stdin`
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '', timedOut = false, outputLimit = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, EXECUTION_TIMEOUT_MS);
    const collect = (key, chunk) => {
      const value = chunk.toString();
      if (key === 'stdout') stdout += value; else stderr += value;
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > MAX_OUTPUT_SIZE && !outputLimit) {
        outputLimit = true; child.kill('SIGKILL');
      }
    };
    child.stdout.on('data', chunk => collect('stdout', chunk));
    child.stderr.on('data', chunk => collect('stderr', chunk));
    child.on('error', error => { clearTimeout(timer); reject(error.code === 'ENOENT' ? fail('Docker is unavailable. Start Docker and try again.', 503) : error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (outputLimit) stderr += '\nOutput limit exceeded.';
      const stdoutLimit = Math.min(Buffer.byteLength(stdout), MAX_OUTPUT_SIZE);
      const stderrLimit = Math.max(0, MAX_OUTPUT_SIZE - stdoutLimit);
      resolve({ stdout: stdout.slice(0, stdoutLimit), stderr: stderr.slice(0, stderrLimit), exitCode: timedOut || outputLimit ? null : code, timedOut });
    });
    child.stdin.end(makeArchive(files, stdin));
  });
}
