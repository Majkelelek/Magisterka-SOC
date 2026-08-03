import type { Alert, TestSession, UserSession } from '../types/alert';
import type { EvaluationReport } from '../types/evaluation';

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

export function cleanAlertStrings<T>(obj: T): T {
  if (!obj) return obj;
  try {
    const json = JSON.stringify(obj);
    if (json.includes('\uFFFD') || json.includes('')) {
      const cleanedJson = json.replace(/[\uFFFD]\s*/g, '- ').replace(/-\s*-/g, '-');
      return JSON.parse(cleanedJson);
    }
  } catch {}
  return obj;
}

export async function fetchAlerts(): Promise<Alert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts`, {
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    if (!res.ok) throw new Error('Błąd połączenia z serwerem');
    const data = await res.json();
    return cleanAlertStrings(data);
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
    const data = await res.json();
    return cleanAlertStrings(data);
  } catch (error) {
    console.error('Nie można pobrać zestawu testowego:', error);
    return [];
  }
}

export async function addTestAlertItem(alert: Partial<Alert>): Promise<{ success: boolean; message: string; alert?: Alert }> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/test-set/item`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(alert)
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Błąd dodawania pytania.' };
    return { success: true, message: data.message, alert: data.alert };
  } catch {
    return { success: false, message: 'Błąd połączenia z serwerem.' };
  }
}

export async function updateTestAlertItem(id: string, alert: Partial<Alert>): Promise<{ success: boolean; message: string; alert?: Alert }> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/test-set/item/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(alert)
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Błąd edycji pytania.' };
    return { success: true, message: data.message, alert: data.alert };
  } catch {
    return { success: false, message: 'Błąd połączenia z serwerem.' };
  }
}

export async function deleteTestAlertItem(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/test-set/item/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Błąd usuwania pytania.' };
    return { success: true, message: data.message };
  } catch {
    return { success: false, message: 'Błąd połączenia z serwerem.' };
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

export async function sendAiQuery(alertId: string, prompt: string): Promise<{ responseText: string; rawResponse?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/ai/query`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ alertId, prompt })
    });
    if (!res.ok) throw new Error('Błąd połączenia z serwisem AI');
    const data = await res.json();

    console.log(`%c[AZURE OPENAI RAW RESPONSE] Alert ID: ${alertId}`, 'color: #ef4444; font-weight: bold; font-size: 12px;');
    console.log(data.rawResponse || data.responseText);
    console.log(`%c[AZURE OPENAI PARSED ANSWER] Alert ID: ${alertId}`, 'color: #38bdf8; font-weight: bold; font-size: 12px;');
    console.log(data.responseText);

    return { responseText: data.responseText, rawResponse: data.rawResponse };
  } catch {
    return { responseText: 'Błąd połączenia z modułem AI backendu.' };
  }
}

export async function askAiAssistant(alertId: string, prompt: string): Promise<{ answer: string; rawResponse?: string }> {
  const res = await sendAiQuery(alertId, prompt);
  return { answer: res.responseText, rawResponse: res.rawResponse };
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

export interface SystemHealthStatus {
  isServerOnline: boolean | null;
  isConnectedToMongoDB: boolean | null;
  databaseProvider: string;
}

export async function getAuthStatus(): Promise<SystemHealthStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/status`);
    if (!res.ok) throw new Error('Status unavailable');
    const data = await res.json();
    return {
      isServerOnline: true,
      isConnectedToMongoDB: !!data.isConnectedToMongoDB,
      databaseProvider: data.databaseProvider || 'MongoDB Atlas'
    };
  } catch {
    return {
      isServerOnline: false,
      isConnectedToMongoDB: false,
      databaseProvider: 'Brak połączenia'
    };
  }
}

// ─── Admin: Question & Test Dataset Management ───────────────

export async function deleteAllTestAlerts(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/test-set/all`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Nie udało się usunąć pytań.' };
    return { success: true, message: data.message };
  } catch {
    return { success: false, message: 'Błąd połączenia z serwerem podczas usuwania pytań.' };
  }
}

export async function importAttackSamples(): Promise<{ success: boolean; message: string; importedCount?: number; totalCount?: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/import-attack-samples`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Nie udało się zaimportować próbek.' };
    return { success: true, message: data.message, importedCount: data.importedCount, totalCount: data.totalCount };
  } catch {
    return { success: false, message: 'Błąd połączenia z serwerem podczas importowania próbek.' };
  }
}

export async function generateSingleAiAnalysis(id: string): Promise<{ success: boolean; message: string; alert?: Alert }> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/${id}/generate-ai`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Błąd generowania analizy AI.' };
    return { success: true, message: data.message, alert: data.alert };
  } catch (err: any) {
    return { success: false, message: err.message || 'Nie udało się połączyć z serwerem.' };
  }
}

export async function generateAllAiAnalyses(): Promise<{ success: boolean; message: string; alerts?: Alert[] }> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/generate-ai-all`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Błąd masowej generacji analiz AI.' };
    return { success: true, message: data.message, alerts: data.alerts };
  } catch (err: any) {
    return { success: false, message: err.message || 'Nie udało się połączyć z serwerem.' };
  }
}

export async function fetchOllamaModels(): Promise<{ success: boolean; models: string[]; isOllamaOnline: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/evaluation/ollama-models`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return { success: false, models: [], isOllamaOnline: false };
    const data = await res.json();
    return { success: data.success, models: data.models || [], isOllamaOnline: !!data.isOllamaOnline };
  } catch {
    return { success: false, models: [], isOllamaOnline: false };
  }
}

export async function runModelEvaluation(
  count: number = 24,
  mode: 'both' | 'base' | 'ft' | 'azure-base' = 'both',
  ollamaModel: string = 'llama3.2',
  samplesPerCategory: number = 2,
  iterations: number = 1
): Promise<{ success: boolean; message: string; report?: EvaluationReport; reports?: EvaluationReport[] }> {
  try {
    const res = await fetch(`${API_BASE_URL}/evaluation/run?count=${count}&mode=${mode}&ollamaModel=${encodeURIComponent(ollamaModel)}&samplesPerCategory=${samplesPerCategory}&iterations=${iterations}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Błąd podczas wykonywania ewaluacji.' };
    return { success: true, message: data.message, report: data.report, reports: data.reports };
  } catch (err: any) {
    return { success: false, message: err.message || 'Nie udało się połączyć z serwerem.' };
  }
}

export async function getLatestEvaluationReport(): Promise<{ success: boolean; message?: string; report?: EvaluationReport }> {
  try {
    const res = await fetch(`${API_BASE_URL}/evaluation/latest`, {
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message };
    return { success: data.success, message: data.message, report: data.report };
  } catch (err: any) {
    return { success: false, message: err.message || 'Nie udało się pobrać ostatniego raportu.' };
  }
}

export async function getEvaluationHistory(): Promise<{ success: boolean; reports: EvaluationReport[] }> {
  try {
    const res = await fetch(`${API_BASE_URL}/evaluation/history`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return { success: false, reports: [] };
    const data = await res.json();
    return { success: true, reports: data.reports || [] };
  } catch {
    return { success: false, reports: [] };
  }
}

export async function deleteEvaluationReport(reportId: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/evaluation/${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    checkResponseStatus(res);
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Błąd usuwania raportu.' };
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, message: err.message || 'Błąd połączenia podczas usuwania.' };
  }
}

