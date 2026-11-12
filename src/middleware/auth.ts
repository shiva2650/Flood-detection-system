import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | { uid: string; email?: string; role?: string; name?: string };
}

export const DEMO_ACCOUNTS: Record<string, { uid: string; email: string; name: string; role: 'admin' | 'citizen' | 'rescue' | 'shelter'; region: string }> = {
  'demo-admin-token': {
    uid: 'demo-admin-uid',
    email: 'commander@alertnet.gov.in',
    name: 'Cmdr. Rajeshwari Rao (NDMA)',
    role: 'admin',
    region: 'Central Basin',
  },
  'demo-citizen-token': {
    uid: 'demo-citizen-uid',
    email: 'ananya.sharma@citizen.in',
    name: 'Ananya Sharma',
    role: 'citizen',
    region: 'Lower Delta Sector 4',
  },
  'demo-rescue-token': {
    uid: 'demo-rescue-uid',
    email: 'ndrf.alpha@alertnet.gov.in',
    name: 'Capt. Vikram Singh (NDRF Alpha-1)',
    role: 'rescue',
    region: 'Central Basin',
  },
  'demo-shelter-token': {
    uid: 'demo-shelter-uid',
    email: 'shelter.highland@alertnet.gov.in',
    name: 'Meera Nair (Highland Relief Camp)',
    role: 'shelter',
    region: 'Highland East',
  },
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (DEMO_ACCOUNTS[token]) {
    req.user = DEMO_ACCOUNTS[token];
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
