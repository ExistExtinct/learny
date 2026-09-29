export function shouldRequireEmailVerification({ required, smtpConfigured, isProduction }) {
  return required && (smtpConfigured || isProduction);
}
