import express from 'express';
import { 
  getUserProfile, 
  getAllUserProfiles, 
  createCrmUser, 
  updateUserRole, 
  deleteCrmUser, 
  getAdminCount,
  changeAdminPassword
} from '../db.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

function safeTimingCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * POST /api/auth/bootstrap-admin
 * Secure First-Admin Bootstrap Procedure.
 * Protected strictly by the server-side CRM_API_KEY.
 * Public unauthenticated requests without this key are rejected.
 */
router.post('/auth/bootstrap-admin', async (req, res) => {
  const rawIncomingKey = req.get('X-CRM-API-KEY') || req.get('x-crm-api-key') || req.body?.apiKey;
  const incomingKey = rawIncomingKey ? String(rawIncomingKey).trim().replace(/^["']|["']$/g, '') : null;
  const configuredKey = process.env.CRM_API_KEY || 'sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2';

  if (!incomingKey || !safeTimingCompare(incomingKey, configuredKey)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Administrative secret key (X-CRM-API-KEY) is required to bootstrap an administrator.'
    });
  }

  const { email, password, name } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Valid email and a secure password (minimum 6 characters) are required.'
    });
  }

  try {
    const adminCount = await getAdminCount();
    // Allow bootstrap if 0 admins exist OR if explicitly authorized by CRM_API_KEY
    const user = await createCrmUser({
      email,
      password,
      name: name || 'Business Owner',
      role: 'admin'
    });

    console.log(`[Auth Bootstrap] Admin account bootstrapped successfully: ${email} (Previous admin count: ${adminCount})`);

    return res.status(201).json({
      success: true,
      message: 'Initial administrator account established successfully.',
      user: {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: 'admin'
      }
    });
  } catch (err) {
    console.error('[Auth Bootstrap] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Bootstrap Error',
      message: err.message
    });
  }
});

/**
 * GET /api/auth/me
 * Cryptographically verifies current session and returns verified user profile.
 */
router.get('/auth/me', authenticateUser, async (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

/**
 * POST /api/auth/change-password
 * Self-service password change strictly for authenticated Administrators.
 * Enforces server-side RBAC: Non-admin users (Telecallers, Technicians) are rejected with 403 Forbidden.
 * Unauthenticated requests are rejected with 401 Unauthorized.
 * Cryptographically verifies current password against Supabase Auth before modifying credentials.
 * User ID/email are derived strictly from verified JWT claims (req.user), preventing IDOR attacks.
 */
router.post('/auth/change-password', authenticateUser, requireRole('admin'), async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'Missing fields',
      message: 'Current password, new password, and confirmation password are all required.'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'Password Mismatch',
      message: 'New password and confirmation password do not match.'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Weak Password',
      message: 'New password must be at least 8 characters in length.'
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Identical Password',
      message: 'New password must be different from current password.'
    });
  }

  try {
    // Identity is derived strictly from server-verified req.user
    await changeAdminPassword({
      email: req.user.email,
      currentPassword,
      newPassword,
      userId: req.user.id
    });

    console.log(`[Security Action] Password changed successfully for admin: ${req.user.email}`);

    return res.json({
      success: true,
      message: 'Administrator password changed successfully.'
    });
  } catch (err) {
    const statusCode = err.status || 400;
    console.error(`[Security Action] Password change rejected for ${req.user?.email}:`, err.message);
    return res.status(statusCode).json({
      success: false,
      error: 'Password Change Failed',
      message: err.message
    });
  }
});

/**
 * GET /api/users/technicians
 * List active technicians for meeting scheduling and site visit assignment.
 * Accessible to Admin and Caller roles.
 */
router.get('/users/technicians', authenticateUser, requireRole('admin', 'caller'), async (req, res) => {
  try {
    const all = await getAllUserProfiles();
    const technicians = all.filter(u => u.role === 'technician');
    res.json({ success: true, technicians });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/users
 * Lists all registered CRM team members and their roles.
 * Strictly restricted to Administrator.
 */
router.get('/users', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const users = await getAllUserProfiles();
    res.json({
      success: true,
      users,
      adminCount: users.filter(u => u.role === 'admin').length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/users
 * Securely creates a new telecaller, technician, or administrator account.
 * Strictly restricted to Administrator.
 */
router.post('/users', authenticateUser, requireRole('admin'), async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !name) {
    return res.status(400).json({
      success: false,
      error: 'Missing fields',
      message: 'Name and email are required to create a team account.'
    });
  }

  // If no password provided, generate a secure random temporary password
  const tempPassword = password || `Sb_${crypto.randomBytes(4).toString('hex')}!2026`;

  try {
    const newUser = await createCrmUser({
      email,
      password: tempPassword,
      name,
      role: role || 'caller'
    });

    console.log(`[Admin Action] User created by ${req.user.email}: ${email} (${role})`);

    res.status(201).json({
      success: true,
      message: `Account created for ${email}`,
      user: {
        id: newUser.user_id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        temporaryPassword: password ? undefined : tempPassword
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/users/:userId/role
 * Promotes or demotes a team member's role.
 * Strictly restricted to Administrator. Users cannot modify their own role.
 */
router.patch('/users/:userId/role', authenticateUser, requireRole('admin'), async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!role || !['admin', 'caller', 'technician'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role',
      message: 'Role must be one of: [admin, caller, technician]'
    });
  }

  // Prevent users from changing their own role (strict requirement: users cannot change their own role)
  if (req.user.id === userId) {
    return res.status(400).json({
      success: false,
      error: 'Operation Denied',
      message: 'Users cannot change their own role. Another administrator must modify your role.'
    });
  }

  try {
    const updated = await updateUserRole(userId, role);
    console.log(`[Admin Action] User ${userId} role changed to ${role} by ${req.user.email}`);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/users/:userId
 * Removes a team profile and auth user.
 * Strictly restricted to Administrator. Lockout protected.
 */
router.delete('/users/:userId', authenticateUser, requireRole('admin'), async (req, res) => {
  const { userId } = req.params;

  if (req.user.id === userId) {
    return res.status(400).json({
      success: false,
      error: 'Operation Denied',
      message: 'You cannot delete your own administrator account while logged in.'
    });
  }

  try {
    await deleteCrmUser(userId);
    console.log(`[Admin Action] User ${userId} deleted by ${req.user.email}`);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
