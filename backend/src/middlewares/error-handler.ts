import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

import { env } from '../config/env';
import { AppError, logger } from '../utils';

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
      message: 'Dados inválidos.',
      details: error.flatten()
    });
    return;
  }

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        message: `Arquivo excede o limite máximo de ${env.MAX_FILE_SIZE_MB} MB.`
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
    message: 'Erro interno no servidor.'
  });
};
