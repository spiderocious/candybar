import {
  AddAudienceMemberSchema,
  CreateAudienceSchema,
  UpdateAudienceSchema,
} from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  addMember,
  createAudience,
  deleteAudience,
  getAudience,
  listAudiences,
  listMembers,
  removeMember,
  updateAudience,
} from './audiences.controller.js';

export const audiencesRoutes: Router = Router();
audiencesRoutes.use('/audiences', ...protect);

audiencesRoutes.get('/audiences', asyncHandler(listAudiences));
audiencesRoutes.post('/audiences', validate(CreateAudienceSchema), asyncHandler(createAudience));

audiencesRoutes.get('/audiences/:id/members', asyncHandler(listMembers));
audiencesRoutes.post(
  '/audiences/:id/members',
  validate(AddAudienceMemberSchema),
  asyncHandler(addMember),
);
audiencesRoutes.delete('/audiences/:id/members/:subscriberId', asyncHandler(removeMember));

audiencesRoutes.get('/audiences/:id', asyncHandler(getAudience));
audiencesRoutes.patch('/audiences/:id', validate(UpdateAudienceSchema), asyncHandler(updateAudience));
audiencesRoutes.delete('/audiences/:id', asyncHandler(deleteAudience));
