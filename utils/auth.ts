import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  phoneNumber: string;
  iat: number;
  exp: number;
}

export const verifyJWT = (token: string): JWTPayload | null => {
  try {
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
};

export const generateJWT = (userId: string, phoneNumber: string): string => {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(
    { 
      userId, 
      phoneNumber,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    },
    jwtSecret
  );
};