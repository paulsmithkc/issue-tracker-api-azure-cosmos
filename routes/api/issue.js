import express from 'express';
import asyncCatch from 'express-async-catch';
import validBody from 'valid-body-joi';
import debug from 'debug';
import { nanoid } from 'nanoid';
import _ from 'lodash';
import Joi from 'joi';
import { isLoggedIn } from '@merlin4/express-auth';
import { Projects, Issues } from '../../core/cosmos.js';

const debugApi = debug('app:api:issue');
const router = express.Router();

const issueSchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().trim().required(),
  priority: Joi.string().trim().allow('').required(), // optional
});

router.get(
  '/issue/list',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const issues = await Issues.getAll();
    res.json(issues);
    debugApi('All issues read.');
  })
);

router.get(
  '/project/:projectId/issue/list',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const issues = await Issues.getAllIssuesForProject(projectId);
    res.json(issues);
    debugApi('All issues for project read.');
  })
);

router.get(
  '/project/:projectId/issue/:issueId',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const issueId = req.params.issueId;
    const issue = await Issues.getById(projectId, issueId);
    if (!issue) {
      res.status(404).json({ message: 'Issue not found.', projectId, issueId });
    } else {
      res.json(issue);
      debugApi(`Issue ${issueId} read.`);
    }
  })
);

router.put(
  '/project/:projectId/issue/new',
  isLoggedIn(),
  validBody(issueSchema),
  asyncCatch(async (req, res, next) => {
    const issueId = nanoid();
    const projectId = req.params.projectId;

    const project = await Projects.getById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.', projectId });
    }

    const now = new Date();
    const newIssue = req.body;
    newIssue.id = issueId;
    newIssue.issueId = issueId;
    newIssue.projectId = projectId;
    newIssue.type = 'Issue';
    newIssue.createdOn = now;
    newIssue.createdBy = _.pick(req.auth, 'userId', 'email');

    const resource = await Issues.add(newIssue);
    res.json({ message: 'Issue created.', id: issueId, resource });
    debugApi(`Issue ${issueId} created.`);
  })
);

router.put(
  '/project/:projectId/issue/:issueId',
  isLoggedIn(),
  validBody(issueSchema),
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const issueId = req.params.issueId;
    const issueData = req.body;
    const issue = await Issues.getById(projectId, issueId);

    if (!issue) {
      res.status(404).json({ message: 'Issue not found.', id: issueId });
    } else {
      for (const key in issueData) {
        issue[key] = issueData[key];
      }

      const now = new Date();
      issue.lastUpdatedOn = now;
      issue.lastUpdatedBy = _.pick(req.auth, 'userId', 'email');

      const resource = await Issues.replace(projectId, issueId, issue);
      res.json({ message: 'Issue updated.', id: issueId, resource });
      debugApi(`Issue ${issueId} updated.`);
    }
  })
);

router.delete(
  '/project/:projectId/issue/:issueId',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const issueId = req.params.issueId;
    const issue = await Issues.getById(projectId, issueId);

    if (!issue) {
      res.status(404).json({ message: 'Issue not found.', id: issueId });
    } else {
      const resource = await Issues.remove(projectId, issueId);
      res.json({ message: 'Issue removed.', id: issueId, resource });
      debugApi(`Issue ${issueId} removed.`);
    }
  })
);

export default router;
