import { Router } from 'express';

import { healthController } from '../controllers';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => healthController.check(req, res));
