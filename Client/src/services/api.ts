import type { Alert, TestSession, UserSession } from '../types/alert';

const API_BASE_URL = 'http://localhost:5000/api';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const saved = sessionStorage.getItem('soc_user_session');
  if (saved) {
    try {
      const session: UserSession = JSON.parse(saved);
      if (session.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
      }
    } catch {
      // Brak tokena sesji
    }
  }

  return headers;
}

function checkResponseStatus(res: Response) {
  if (res.status === 401) {
    sessionStorage.removeItem('soc_user_session');
    window.dispatchEvent(new Event('soc_unauthorized_logout'));
  }
}

export async function verifyCurrentSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/verify`, {
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Alerts API ───────────────────────────────────────────────

export async function fetchAlerts(): Promise<Alert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts`, {
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    if (!res.ok) throw new Error('Błąd połączenia z serwerem');
    return await res.json();
  } catch (error) {
    console.error('Nie można pobrać alertów z serwera:', error);
    return [];
  }
}

export async function fetchTestSet(): Promise<Alert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/test-set`, {
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    if (!res.ok) throw new Error('Błąd pobierania pytań testowych');
    return await res.json();
  } catch (error) {
    console.error('Nie można pobrać zestawu testowego:', error);
    return [];
  }
}

export async function createAlert(alert: Partial<Alert>): Promise<Alert | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(alert)
    });
    if (!res.ok) throw new Error('Błąd zapisu alertu');
    return await res.json();
  } catch (error) {
    console.error('Błąd tworzenia alertu:', error);
    return null;
  }
}

export async function updateAlertStatus(id: string, status: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function submitTestSession(session: TestSession): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/session/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(session)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchTestSessions(): Promise<TestSession[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/session`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function deleteTestSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteAllTestSessions(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/session/all`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── AI API ───────────────────────────────────────────────────

export async function sendAiQuery(alertId: string, prompt: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE_URL}/ai/query`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ alertId, prompt })
    });
    if (!res.ok) throw new Error('Błąd połączenia z serwisem AI');
    const data = await res.json();
    return data.responseText;
  } catch {
    return 'Błąd połączenia z modułem AI backendu.';
  }
}

// ─── Authentication API ───────────────────────────────────────

export async function loginUser(username: string, password: string): Promise<UserSession | { error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return { error: data.message || 'Nieudana próba logowania.' };

    return {
      token: data.token,
      username: data.user.username,
      email: data.user.email,
      role: data.user.role,
      databaseMode: data.databaseMode
    };
  } catch {
    return { error: 'Błąd połączenia z serwerem uwierzytelniania.' };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch {
    // ignoruj błędy przy wylogowaniu
  }
}

// ─── Admin: User Management API ──────────────────────────────

export async function registerUserByAdmin(username: string, password: string, role: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Rejestracja nie powiodła się.' };
    return { success: true, message: data.message };
  } catch {
    return { success: false, message: 'Błąd połączenia z serwerem.' };
  }
}

export async function fetchRegisteredUsers(): Promise<Array<{ id: string; username: string; email: string; role: string }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/users`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function changeUserPasswordByAdmin(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/users/${userId}/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword })
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Nie udało się zmienić hasła.' };
    return { success: true, message: data.message };
  } catch {
    return { success: false, message: 'Błąd połączenia z serwerem.' };
  }
}

// ─── Admin: Session Management API ───────────────────────────

export async function fetchActiveSessions(): Promise<Array<{ id: string; username: string; role: string; createdAt: string; expiresAt: string }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/sessions`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ─── System Status ───────────────────────────────────────────

export async function getAuthStatus(): Promise<{ isConnectedToMongoDB: boolean; databaseProvider: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/status`);
    if (!res.ok) throw new Error('Status unavailable');
    return await res.json();
  } catch {
    return { isConnectedToMongoDB: false, databaseProvider: 'Brak połączenia' };
  }
}
