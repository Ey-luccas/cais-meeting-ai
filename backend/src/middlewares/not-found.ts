import type { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`
  });
};
