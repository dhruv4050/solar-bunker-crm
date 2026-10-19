import { supabase, getUserProfile } from '../db.js';

/**
 * Middleware: Cryptographically verify user's Supabase JWT access token
 * and fetch their authoritative role from the user_profiles database table.
 */
export async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Missing Bearer token.'
    });
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Malformed Bearer token.'
    });
  }

  try {
    // Cryptographically verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: error?.message || 'Invalid or expired session token. Please sign in again.'
      });
    }

    // Query authoritative role from database table
    const profile = await getUserProfile(user.id);
    if (!profile || !profile.role) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'No CRM role assigned to this account. Protected access denied. Please contact an administrator.'
      });
    }

    // Attach verified user identity and role to request
    req.user = {
      id: user.id,
      email: user.email,
      name: profile.name || user.email,
      role: profile.role
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware] Verification error:', err.message);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Session verification failed.'
    });
  }
}

/**
 * Role-Based Access Control Middleware Factory
 * Ensures the authenticated user has one of the allowed roles.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required before checking roles.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access denied. Your role (${req.user.role}) is not authorized for this operation. Requires: [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
}

export default {
  authenticateUser,
  requireRole
};
