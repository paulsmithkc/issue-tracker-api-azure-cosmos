import express from 'express';
import asyncCatch from 'express-async-catch';
import validBody from 'valid-body-joi';
import debug from 'debug';
import { nanoid } from 'nanoid';
import Joi from 'joi';
import cosmos from '../../core/cosmos.js';

const debugApi = debug('app:api:issue');
const router = express.Router();

const issueSchema = Joi.object({
  type: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
});

router.get(
  '/list',
  asyncCatch(async (req, res, next) => {
    const issues = await cosmos.getAllIssues();
    res.json(issues);
  })
);
router.get(
  '/:issueId',
  asyncCatch(async (req, res, next) => {
    const issueId = req.params.issueId;
    const issue = await cosmos.getIssueById(issueId);
    if (issue) {
      res.json(issue);
    } else {
      res.status(404).json({ id: issueId, message: 'Issue not found.' });
    }
  })
);
router.put(
  '/new',
  validBody(issueSchema),
  asyncCatch(async (req, res, next) => {
    const newIssue = req.body;
    newIssue.id = nanoid();
    const createdIssue = await cosmos.addIssue(newIssue);
    res.json({ id: createdIssue.id, message: 'Issue created.', });
  })
);

export default router;
