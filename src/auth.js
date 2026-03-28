export const AUTH_ERROR = {
  error: 'Unauthorized',
  message: 'API_TOKEN is required. Use ?token=<your_token> or Authorization: Bearer <your_token>',
}

export function verifyToken(token) {
  // Read directly from process.env to support Workers where env is populated at runtime
  return token === process.env.API_TOKEN
}
