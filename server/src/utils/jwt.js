import jwt from 'jsonwebtoken'
import User from '../models/user.js'

const {
    JWT_SECRET,
    JWT_EXPIRES_IN = '30d',
} = process.env

if (!JWT_SECRET) {
    throw new Error(
        'JWT_SECRET environment variable is not set. Refusing to start.'
    )
}

const TOKEN_FIELDS = [
    '_id',
    'username',
    'email',
    'permissions',
    'status',
    'tokenVersion',
].join(' ')

export const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            username: user.username,
            email: user.email,
            tokenVersion: user.tokenVersion || 0,
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN,
        }
    )
}

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET)
    } catch {
        return null
    }
}

const extractTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return null
    }

    const parts = authHeader.split(' ')

    return parts.length === 2 ? parts[1] : null
}

const loadUserFromToken = async (decoded) => {
    return User.findById(decoded.id)
        .select(TOKEN_FIELDS)
        .lean()
}

const isTokenValidForUser = (decoded, user) => {
    return (
        user &&
        user.status === 'active' &&
        (decoded.tokenVersion ?? 0) ===
            (user.tokenVersion ?? 0)
    )
}

const attachUserToRequest = (req, user) => {
    req.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        permissions: user.permissions,
        status: user.status,
    }
}

export const optionalAuthenticateToken = async (
    req,
    res,
    next
) => {
    const token = extractTokenFromHeader(req)

    if (!token) {
        return next()
    }

    const decoded = verifyToken(token)

    if (!decoded) {
        return next()
    }

    try {
        const user = await loadUserFromToken(decoded)

        if (isTokenValidForUser(decoded, user)) {
            attachUserToRequest(req, user)
        }
    } catch {
        // silent — optional auth never blocks the request
    }

    next()
}

export const authenticateToken = async (
    req,
    res,
    next
) => {
    const token = extractTokenFromHeader(req)

    if (!token) {
        return res.status(401).json({
            error: 'Access token required',
        })
    }

    const decoded = verifyToken(token)

    if (!decoded) {
        return res.status(403).json({
            error: 'Invalid or expired token',
        })
    }

    try {
        const user = await loadUserFromToken(decoded)

        if (!user) {
            return res.status(403).json({
                error: 'User not found',
            })
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                error: 'Account suspended',
                code: 'SUSPENDED',
            })
        }

        if (
            (decoded.tokenVersion ?? 0) !==
            (user.tokenVersion ?? 0)
        ) {
            return res.status(403).json({
                error: 'Token revoked',
                code: 'TOKEN_REVOKED',
            })
        }

        attachUserToRequest(req, user)

        next()
    } catch {
        return res.status(500).json({
            error: 'Internal server error',
        })
    }
}
