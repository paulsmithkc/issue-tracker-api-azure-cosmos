import express from 'express';
import asyncCatch from 'express-async-catch';
import validBody from 'valid-body-joi';
import debug from 'debug';
import { nanoid } from 'nanoid';
import Joi from 'joi';
import { Projects } from '../../core/cosmos.js';

const debugApi = debug('app:api:project');
const router = express.Router();

const projectSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  priority: Joi.string().allow('').required(), // optional
});

router.get(
  '/project/list',
  asyncCatch(async (req, res, next) => {
    const projects = await Projects.getAll();
    res.json(projects);
    debugApi('All projects read.');
  })
);

router.get(
  '/project/:projectId',
  asyncCatch(async (req, res, next) => {
    const projectId = req.params.projectId;
    const project = await Projects.getById(projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.', id: projectId });
    } else {
      res.json(issue);
      debugApi(`Project ${projectId} read.`);
    }
  })
);

router.put(
  '/project/new',
  validBody(projectSchema),
  asyncCatch(async (req, res, next) => {
    const projectId = nanoid();
    const newProject = req.body;
    newProject.id = projectId;
    newProject.projectId = projectId;
    newProject.type = 'Project';

    const resource = await Projects.add(newProject);
    res.json({ message: 'Project created.', id: projectId, resource });
    debugApi(`Project ${issueId} created.`);
  })
);

router.put(
  '/project/:projectId',
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
      const resource = await Projects.replace(projectId, project);
      res.json({ message: 'Project updated.', id: projectId, resource });
      debugApi(`Project ${projectId} updated.`);
    }
  })
);

router.delete(
  '/project/:projectId',
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
