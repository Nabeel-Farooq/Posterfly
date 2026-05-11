import express from 'express'
import passport from 'passport'

import AuthController from '../controllers/authController.js'
import { authenticateToken } from '../utils/jwt.js'

const router = express.Router()

const CLIENT_URL = process.env.CLIENT_URL

const encodeState = (redirect) =>
    Buffer.from(
        JSON.stringify({ redirect })
    ).toString('base64url')

const getRedirectUrl = (req) =>
    req.query.redirect || `${CLIENT_URL}/login`

const authenticateProvider = (provider, scope) => (
    req,
    res,
    next
) => {
    const redirect = getRedirectUrl(req)

    passport.authenticate(provider, {
        scope,
        state: encodeState(redirect),
    })(req, res, next)
}

const getFailureRedirect = (provider) =>
    `${CLIENT_URL}/login?error=${provider}_failed`

router.get(
    '/google',
    authenticateProvider('google', ['profile', 'email'])
)

router.get(
    '/google/callback',
    passport.authenticate('google', {
        failureRedirect: getFailureRedirect('google'),
    }),
    AuthController.googleCallback
)

router.get(
    '/spotify',
    authenticateProvider('spotify', [
        'user-read-email',
        'user-read-private',
    ])
)

router.get(
    '/spotify/callback',
    passport.authenticate('spotify', {
        failureRedirect: getFailureRedirect('spotify'),
    }),
    AuthController.spotifyCallback
)

router.post('/logout', AuthController.logout)

router.get(
    '/user',
    authenticateToken,
    AuthController.getUser
)

export default router
