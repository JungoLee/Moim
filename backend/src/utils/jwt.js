import jwt from 'jsonwebtoken';

function secret() {
  return process.env.JWT_SECRET || 'dev-secret';
}

export function signToken(payload) {
  return jwt.sign(payload, secret(), { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, secret());
}
