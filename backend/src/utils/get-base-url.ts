import type { Request } from 'express';

export const getBaseUrl = (req: Request): string => `${req.protocol}://${req.get('host')}`;
