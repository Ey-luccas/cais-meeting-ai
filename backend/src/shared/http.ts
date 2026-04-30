import type { Request } from 'express';

export const getBaseUrl = (req: Request): string => {
  const forwardedHostHeader = req.headers['x-forwarded-host'];
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : forwardedHostHeader;
  const hostCandidate = forwardedHost?.split(',')[0]?.trim();
  const host = hostCandidate || req.get('host') || 'localhost';

  return `${req.protocol}://${host}`;
};
