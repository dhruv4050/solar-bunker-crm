import { createClient } from '@supabase/supabase-js';

const AUTH_USER_KEY = 'solar_bunker_active_profile';

// Default public keys (fallback if /api/config is loading or offline)
const DEFAULT_SUPABASE_URL = 'https://muqrumruisowcvllxaeo.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXJ1bXJ1aXNvd2N2bGx4YWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTI0MDAsImV4cCI6MjEwNzAyODQwMH0.MgNLazO5Ht9yuJ_6SsnfFQVt7HKTY5B81ejGAF2QHZY';

let supabaseClient = null;
let currentProfile = null;

/**
 * Initializes the client-side Supabase client singleton
 */
export async function getSupabase() {
  if (supabaseClient) return supabaseClient;

  let url = DEFAULT_SUPABASE_URL;
  let anonKey = DEFAULT_ANON_KEY;

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl) url = data.supabaseUrl;
      if (data.supabaseAnonKey) anonKey = data.supabaseAnonKey;
    }
  } catch (err) {
    console.warn('[Auth] Using default public Supabase endpoints:', err.message);
  }

  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return supabaseClient;
}

// Synchronous accessor for fast initial renders
export function getSupabaseSync() {
  if (!supabaseClient) {
    supabaseClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseClient;
}

/**
 * Get current Bearer access token for backend requests
 */
export async function getAuthToken() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

/**
 * Get cached or in-memory verified profile
 */
export function getCurrentUser() {
  if (currentProfile) return currentProfile;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Evict legacy mock personas from earlier iterations (e.g. admin-1, caller-1, tech-1)
      if (parsed && (!parsed.email || parsed.id === 'admin-1' || parsed.id === 'caller-1' || parsed.id === 'tech-1')) {
        console.warn('[Auth] Evicting legacy mock profile from localStorage:', parsed.id);
        localStorage.removeItem(AUTH_USER_KEY);
        return null;
      }
      currentProfile = parsed;
      return currentProfile;
    }
  } catch (err) {
    console.error('[Auth] Error reading cached profile:', err);
  }
  return null;
}

/**
 * Authenticates with Supabase Auth (email/password), verifies user profile with backend,
 * and enforces that the account has an assigned role.
 */
export async function signIn(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    throw new Error(error.message || 'Invalid email or password.');
  }

  if (!data?.session) {
    throw new Error('No session returned. Please check your credentials.');
  }

  const token = data.session.access_token;

  // Verify role with backend
  const verifyRes = await fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!verifyRes.ok) {
    // Sign out immediately if no valid CRM profile
    await sb.auth.signOut();
    localStorage.removeItem(AUTH_USER_KEY);
    currentProfile = null;

    if (verifyRes.status === 403) {
      throw new Error('Access Denied: This account has not been assigned a CRM role (Admin, Caller, or Technician). Contact your administrator.');
    }
    const errBody = await verifyRes.json().catch(() => ({}));
    throw new Error(errBody.message || 'Failed to verify CRM user permissions.');
  }

  const profileData = await verifyRes.json();
  currentProfile = profileData.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentProfile));

  window.dispatchEvent(new CustomEvent('solar_bunker_auth_changed', { detail: currentProfile }));
  return currentProfile;
}

/**
 * Signs out of Supabase Auth and clears session
 */
export async function signOut() {
  try {
    const sb = await getSupabase();
    await sb.auth.signOut();
  } catch (err) {
    console.error('[Auth] Error signing out:', err);
  } finally {
    currentProfile = null;
    localStorage.removeItem(AUTH_USER_KEY);
    window.dispatchEvent(new CustomEvent('solar_bunker_auth_changed', { detail: null }));
  }
}

/**
 * Refreshes and verifies the current session from the server
 */
export async function refreshSession() {
  const sb = await getSupabase();
  const { data: { session }, error } = await sb.auth.getSession();

  if (error || !session) {
    currentProfile = null;
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }

  // If this is a password recovery session, let the user complete password reset first
  const isRecovery = window.location.hash?.includes('type=recovery') || window.location.search?.includes('type=recovery');
  if (isRecovery) {
    return null;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!res.ok) {
      await signOut();
      return null;
    }

    const { user } = await res.json();
    currentProfile = user;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    console.error('[Auth] Failed to verify session:', err);
    return getCurrentUser();
  }
}

/**
 * Request password recovery email using Supabase Auth.
 * Redirects back to production domain with recovery tokens.
 */
export async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const sb = await getSupabase();
  const origin = window.location.origin || 'https://solar-bunker-crm.onrender.com';
  
  const { data, error } = await sb.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${origin}/`
  });

  if (error) {
    throw new Error(error.message || 'Failed to send password reset email.');
  }

  return { success: true, message: 'Password reset link sent successfully.' };
}

/**
 * Updates user password during an active recovery session.
 */
export async function updateUserPassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const sb = await getSupabase();
  const { data, error } = await sb.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error(error.message || 'Failed to update password.');
  }

  return data;
}

// ─── TEAM ACCOUNTS MANAGEMENT (ADMIN ONLY VIA BACKEND) ───

export async function getAllUsers() {
  const token = await getAuthToken();
  if (!token) return [];

  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load team users');
    const data = await res.json();
    return data.users || [];
  } catch (err) {
    console.error('[Auth Service] Error fetching users:', err);
    return [];
  }
}

export async function getTechnicians() {
  const token = await getAuthToken();
  if (!token) return [];

  try {
    const res = await fetch('/api/users/technicians', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.technicians || [];
  } catch (err) {
    console.error('[Auth Service] Error fetching technicians:', err);
    return [];
  }
}

export async function addUser({ name, email, role, password }) {
  const token = await getAuthToken();
  if (!token) throw new Error('Unauthorized');

  const res = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name, email, role, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to create user');
  }
  return data.user;
}

export async function updateUserRole(userId, newRole) {
  const token = await getAuthToken();
  if (!token) throw new Error('Unauthorized');

  const res = await fetch(`/api/users/${userId}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ role: newRole })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to update user role');
  }
  return data.user;
}

export async function deleteUser(userId) {
  const token = await getAuthToken();
  if (!token) throw new Error('Unauthorized');

  const res = await fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to delete user');
  }
  return true;
}

export default {
  getSupabase,
  getSupabaseSync,
  getAuthToken,
  getCurrentUser,
  signIn,
  signOut,
  refreshSession,
  getAllUsers,
  getTechnicians,
  addUser,
  updateUserRole,
  deleteUser
};
