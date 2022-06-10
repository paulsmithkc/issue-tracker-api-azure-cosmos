import express from 'express';
import asyncCatch from 'express-async-catch';
import validBody from 'valid-body-joi';
import debug from 'debug';
import config from 'config';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import _ from 'lodash';
import expressAuth from '@merlin4/express-auth';
import { Users } from '../../core/cosmos.js';

const debugApi = debug('app:api:auth');
const router = express.Router();

const registerSchema = Joi.object({
  givenName: Joi.string().required(),
  familyName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const { passwordSaltRounds, tokenSecretKey, tokenExpiresIn } =
  config.get('auth');

/**
 * Generate a new JWT auth token for a user.
 * @param {any} user user data
 * @returns {Promise<string>} auth token
 */
function generateToken({ userId, email, givenName, familyName }) {
  return jwt.sign({ userId, email, givenName, familyName }, tokenSecretKey, {
    expiresIn: tokenExpiresIn,
  });
}

router.post(
  '/auth/register',
  validBody(registerSchema),
  asyncCatch(async (req, res, next) => {
    const userId = nanoid();
    const { givenName, familyName, email, password } = req.body;

    const existingUser = await Users.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use.', email });
    }

    const newUser = {
      id: userId,
      userId,
      givenName,
      familyName,
      email,
      passwordHash: await bcrypt.hash(password, passwordSaltRounds),
      type: 'User',
    };

    const token = await generateToken(newUser);

    const resource = await Users.add(newUser);
    res.json({
      message: 'User registered.',
      email,
      userId,
      token,
      tokenExpiresIn,
    });
    debugApi(`User ${userId} registered.`);
  })
);

router.post(
  '/auth/login',
  validBody(loginSchema),
  asyncCatch(async (req, res, next) => {
    const { email, password } = req.body;

    const user = await Users.getByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res
        .status(400)
        .json({ message: 'Incorrect email or password.', email });
    } else {
      const { userId } = user;
      const token = await generateToken(user);
      res.json({
        message: 'User logged in.',
        email,
        userId,
        token,
        tokenExpiresIn,
      });
      debugApi(`User ${userId} logged in.`);
    }
  })
);

router.get(
  '/auth/me',
  expressAuth.isLoggedIn(),
  asyncCatch(async (req, res, next) => {
    const { userId, email } = req.auth;
    const user = await Users.getById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.', userId });
    } else {
      return res.json(_.pick(user, 'userId', 'email', 'givenName', 'familyName'));
    }
  })
);

export default router;