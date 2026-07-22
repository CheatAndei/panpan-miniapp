const MALFORMED_SIGN_RE = /(?:\+|-|−)\s*(?:\+|-|−)\s*(?=\d|\.)/u;

function normalizeMathDisplay(value) {
  return String(value ?? '')
    .replace(/\+\s*-\s*((?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?)/gu, '+ (−$1)')
    .replace(/-\s*-\s*((?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?)/gu, '− (−$1)')
    .replace(/-/gu, '−');
}

function signedOperand(value) {
  const text = String(value ?? '').trim();
  return text.startsWith('-') ? `(−${text.slice(1)})` : normalizeMathDisplay(text);
}

function normalizeLinearEquationDisplay(value) {
  return String(value ?? '')
    .replace(/\+\s*-\s*((?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?)/gu, ' − $1')
    .replace(/\+/gu, ' + ')
    .replace(/=/gu, ' = ')
    .replace(/-/gu, '−')
    .replace(/\s+/gu, ' ')
    .trim();
}

function hasMalformedSignedOperators(value) {
  return MALFORMED_SIGN_RE.test(String(value ?? ''));
}

module.exports = {
  MALFORMED_SIGN_RE,
  normalizeMathDisplay,
  normalizeLinearEquationDisplay,
  signedOperand,
  hasMalformedSignedOperators,
};
