import type { Request } from 'express';

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim();
  }
  return req.ip;
}

export function getUserAgent(req: Request): string | undefined {
  const header = req.headers['user-agent'];
  if (typeof header !== 'string' || !header.trim()) return undefined;
  return header.slice(0, 512);
}
