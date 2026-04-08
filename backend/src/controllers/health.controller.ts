import type { Request, Response } from 'express';

export class HealthController {
  check(_req: Request, res: Response): void {
    res.json({
      status: 'ok',
      service: 'cais-meeting-ai-backend'
    });
  }
}

export const healthController = new HealthController();
