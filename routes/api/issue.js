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
  title: Joi.string().required(),
  description: Joi.string().required(),
  priority: Joi.string().required(),
});

router.get(
  '/list',
  asyncCatch(async (req, res, next) => {
    const issues = await cosmos.getAllIssues();
    res.json(issues);
    debugApi('All issues read.');
  })
);

router.get(
  '/:issueId',
  asyncCatch(async (req, res, next) => {
    const issueId = req.params.issueId;
    const issue = await cosmos.getIssueById(issueId);
    if (issue) {
      res.json(issue);
      debugApi(`Issue ${issueId} read.`);
    } else {
      res.status(404).json({ message: 'Issue not found.', id: issueId });
    }
  })
);

router.put(
  '/new',
  validBody(issueSchema),
  asyncCatch(async (req, res, next) => {
    const issueId = nanoid();
    const newIssue = req.body;
    newIssue.id = issueId;
    newIssue.issueId = issueId;

    const resource = await cosmos.addIssue(newIssue);
    res.json({ message: 'Issue created.', id: issueId, resource });
    debugApi(`Issue ${issueId} created.`);
  })
);

router.put(
  '/:issueId',
  validBody(issueSchema),
  asyncCatch(async (req, res, next) => {
    const issueId = req.params.issueId;
    const issueData = req.body;
    const issue = await cosmos.getIssueById(issueId);

    if (!issue) {
      res.status(404).json({ message: 'Issue not found.', id: issueId });
    } else {
      for (const key in issueData) {
        issue[key] = issueData[key];
      }
      const resource = await cosmos.replaceIssue(issueId, issue);
      res.json({ message: 'Issue updated.', id: issueId, resource });
      debugApi(`Issue ${issueId} updated.`);
    }
  })
);

router.delete(
  '/:issueId',
  asyncCatch(async (req, res, next) => {
    const issueId = req.params.issueId;
    const issue = await cosmos.getIssueById(issueId);

    if (!issue) {
      res.status(404).json({ message: 'Issue not found.', id: issueId });
    } else {
      const resource = await cosmos.removeIssue(issueId, issue.type);
      res.json({ message: 'Issue removed.', id: issueId, resource });
      debugApi(`Issue ${issueId} removed.`);
    }
  })
);

export default router;
