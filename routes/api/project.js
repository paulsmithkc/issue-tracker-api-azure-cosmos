import express from 'express';
import asyncCatch from 'express-async-catch';
import validBody from 'valid-body-joi';
import debug from 'debug';
import { nanoid } from 'nanoid';
import _ from 'lodash';
import Joi from 'joi';
import { isLoggedIn } from '@merlin4/express-auth';
import { Projects } from '../../core/cosmos.js';

const debugApi = debug('app:api:project');
const router = express.Router();

const projectSchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().trim().required(),
  priority: Joi.string().trim().allow('').required(), // optional
});

router.get(
  '/project/list',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const projects = await Projects.getAll();
    res.json(projects);
    debugApi('All projects read.');
  })
);

router.get(
  '/project/:projectId',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const project = await Projects.getById(projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.', id: projectId });
    } else {
      res.json(project);
      debugApi(`Project ${projectId} read.`);
    }
  })
);

router.put(
  '/project/new',
  isLoggedIn(),
  validBody(projectSchema),
  asyncCatch(async (req, res, next) => {
    const projectId = nanoid();

    const now = new Date();
    const newProject = req.body;
    newProject.id = projectId;
    newProject.projectId = projectId;
    newProject.type = 'Project';
    newProject.createdOn = now;
    newProject.createdBy = _.pick(req.auth, 'userId', 'email');

    const resource = await Projects.add(newProject);
    res.json({ message: 'Project created.', id: projectId, resource });
    debugApi(`Project ${issueId} created.`);
  })
);

router.put(
  '/project/:projectId',
  isLoggedIn(),
  validBody(projectSchema),
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const projectData = req.body;
    const project = await Projects.getById(projectId);

    if (!project) {
      res.status(404).json({ message: 'Project not found.', id: projectId });
    } else {
      for (const key in projectData) {
        project[key] = projectData[key];
      }

      const now = new Date();
      project.lastUpdatedOn = now;
      project.lastUpdatedBy = _.pick(req.auth, 'userId', 'email');

      const resource = await Projects.replace(projectId, project);
      res.json({ message: 'Project updated.', id: projectId, resource });
      debugApi(`Project ${projectId} updated.`);
    }
  })
);

router.delete(
  '/project/:projectId',
  isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const project = await Projects.getById(projectId);

    if (!project) {
      res.status(404).json({ message: 'Project not found.', id: projectId });
    } else {
      const resource = await Projects.remove(projectId);
      res.json({ message: 'Project removed.', id: projectId, resource });
      debugApi(`Project ${projectId} removed.`);
    }
  })
);

export default router;
