import { normalizeRequest } from './code-execution.js';
import { containsUnsafeCode } from './code-safety.js';

function parseJson(answer) {
  const text = answer.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function simulateCode(input, { callAI, provider }) {
  const { files, stdin } = normalizeRequest(input);
  const source = files.map(file => `--- ${file.path} ---\n${file.content}`).join('\n\n');
  const language = input.language.trim().toLowerCase();
  if (containsUnsafeCode(source)) {
    return {
      stdout: '',
      stderr: 'This code uses a blocked operation and was not run.',
      exitCode: null,
      timedOut: false,
      executed: false,
      simulated: true,
      simulationLabel: 'AI review blocked — code was not run',
      blocked: true
    };
  }
  const preflight = await callAI({
    provider,
    system: `Review submitted code for safety and obvious errors. Do not run code. Return JSON only with exactly {"safe":boolean,"hasMistake":boolean,"feedback":"short explanation"}. Treat filesystem, network, secrets, dynamic evaluation and destructive behavior as unsafe.`,
    message: `Language: ${language}\nstdin:\n${stdin}\nCode:\n${source}`,
    maxOutputTokens: 500
  });
  const gate = parseJson(preflight.answer);
  if (!gate || typeof gate.safe !== 'boolean' || typeof gate.hasMistake !== 'boolean') {
    throw Object.assign(new Error('AI returned an invalid safety review. Code was not run.'), { statusCode: 502 });
  }
  if (!gate.safe || gate.hasMistake) {
    return {
      stdout: '',
      stderr: String(gate.feedback || 'AI review blocked this code.').slice(0, 1000),
      exitCode: null,
      timedOut: false,
      executed: false,
      simulated: true,
      simulationLabel: 'AI review blocked — code was not run',
      blocked: true
    };
  }

  const prediction = await callAI({
    provider,
    system: `Predict the likely console output of this ${language} program without executing, compiling, or running it. Return JSON only with exactly {"stdout":"predicted output","stderr":"likely errors or empty string","exitCode":integer or null,"explanation":"brief uncertainty note"}. Do not claim to have executed the program. If the result cannot be reliably inferred, say so in explanation and use null exitCode.`,
    message: `Language: ${language}\nstdin:\n${stdin}\nFiles:\n${files.map(file => `--- ${file.path} ---\n${file.content}`).join('\n\n')}`,
    maxOutputTokens: 1200
  });
  const result = parseJson(prediction.answer);
  if (!result || typeof result.stdout !== 'string' || typeof result.stderr !== 'string' ||
      !(Number.isInteger(result.exitCode) || result.exitCode === null)) {
    throw Object.assign(new Error('AI returned an invalid output prediction. Code was not run.'), { statusCode: 502 });
  }
  return {
    stdout: result.stdout.slice(0, 200_000),
    stderr: result.stderr.slice(0, 200_000),
    exitCode: result.exitCode,
    timedOut: false,
    executed: false,
    simulated: true,
    simulationLabel: 'AI-predicted output — not executed',
    explanation: String(result.explanation || '').slice(0, 1000),
    language: input.language.trim().toLowerCase()
  };
}
