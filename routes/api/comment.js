import express from 'express';
import asyncCatch from 'express-async-catch';
import validBody from 'valid-body-joi';
import debug from 'debug';
import { nanoid } from 'nanoid';
import _ from 'lodash';
import Joi from 'joi';
import { isLoggedIn } from '@merlin4/express-auth';
import { Issues, IssueComments } from '../../core/cosmos.js';

const debugApi = debug('app:api:comment');
const router = express.Router();

const commentSchema = Joi.object({
  text: Joi.string().trim().required(),
});

router.get(
  '/comment/list',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const comments = await IssueComments.getAll();
    res.json(comments);
    debugApi('All comments read.');
  })
);

router.get(
  '/project/:projectId/issue/:issueId/comment/list',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const { projectId, issueId } = req.params;
    const comments = await IssueComments.getAllCommentsForIssue(projectId, issueId);
    res.json(comments);
    debugApi('All comments for issue read.');
  })
);

router.put(
  '/project/:projectId/issue/:issueId/comment/new',
  isLoggedIn(),
  validBody(commentSchema),
  asyncCatch(async (req, res, next) => {
    const commentId = nanoid();
    const { projectId, issueId } = req.params;

    const issue = await Issues.getById(projectId, issueId);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.', issueId });
    }

    const now = new Date();
    const newComment = req.body;
    newComment.id = commentId;
    newComment.issueId = issueId;
    newComment.projectId = projectId;
    newComment.type = 'Comment';
    newComment.createdOn = now;
    newComment.createdBy = _.pick(req.auth, 'userId', 'email');

    const resource = await IssueComments.add(newComment)
    res.json({ message: 'Comment created.', id: issueId, resource });
    debugApi(`Comment ${commentId} created.`);
  })
);

export default router;
