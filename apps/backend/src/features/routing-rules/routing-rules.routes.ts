import { CreateRoutingRuleSchema, UpdateRoutingRuleSchema } from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  createRule,
  deleteRule,
  getRule,
  listRules,
  updateRule,
} from './routing-rules.controller.js';

export const routingRulesRoutes: Router = Router();
routingRulesRoutes.use('/routing-rules', ...protect);

routingRulesRoutes.get('/routing-rules', asyncHandler(listRules));
routingRulesRoutes.post('/routing-rules', validate(CreateRoutingRuleSchema), asyncHandler(createRule));
routingRulesRoutes.get('/routing-rules/:id', asyncHandler(getRule));
routingRulesRoutes.patch(
  '/routing-rules/:id',
  validate(UpdateRoutingRuleSchema),
  asyncHandler(updateRule),
);
routingRulesRoutes.delete('/routing-rules/:id', asyncHandler(deleteRule));
