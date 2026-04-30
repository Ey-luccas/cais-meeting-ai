import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

import { AppError } from '../shared/app-error';
import { logger } from '../shared/logger';

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Payload inválido.',
      details: error.flatten()
    });
    return;
  }

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        message: 'Arquivo excede o tamanho permitido para upload.'
      });
      return;
    }

    res.status(400).json({
      message: error.message
    });
    return;
  }

  logger.error('Erro não tratado na API.', error);

  res.status(500).json({
    message: 'Erro interno do servidor.'
  });
};
