const harmfulCodePattern = /\b(?:process\.|require\s*\(|import\s*\(|fetch\s*\(|XMLHttpRequest\b|WebSocket\b|document\.cookie\b|localStorage\b|sessionStorage\b|indexedDB\b|navigator\.sendBeacon\b|eval\s*\(|Function\s*\(|location\.(?:assign|replace)\b|window\.open\b)/i;

export function containsUnsafeCode(code) {
  return harmfulCodePattern.test(code);
}
