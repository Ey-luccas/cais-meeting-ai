import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export const asyncHandler = (handler: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
};
