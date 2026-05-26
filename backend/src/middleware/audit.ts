import { Response, NextFunction } from 'express';
import { db } from '../db/database';
import { AuthRequest } from './auth';

export function auditLog(action: string, resource: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode < 400 && req.user) {
        const resourceId = req.params.id || (body as Record<string, unknown>)?.id as string || null;
        db.prepare(`INSERT INTO audit_logs (user_id, username, action, resource, resource_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(req.user.id, req.user.username, action, resource, resourceId,
            JSON.stringify({ method: req.method, body: req.method !== 'GET' ? req.body : undefined }),
            req.ip || req.headers['x-forwarded-for'] as string || 'unknown');
      }
      return originalJson(body);
    };
    next();
  };
}
