export interface Alert {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  status: 'New' | 'In Progress' | 'Resolved' | 'Escalated';
  timestamp: string;
  sourceIp: string;
  destinationHost: string;
  userAccount: string;
  mitreTechnique: string;
  description: string;
  rawLogs: string[];
  
  // Pola ewaluacji (testu)
  isThreat?: boolean;
  correctAction?: string;

  // Pola wzbogacone przez AI (dla widoku Z AI)
  aiSummary?: string;
  aiConfidenceScore?: number;
  aiRiskAnalysis?: string;
  aiRecommendedActions?: string[];
}

export interface OperatorDecision {
  alertId: string;
  actionTaken: string;
  decisionTimeSeconds: number;
  timestamp: string;
  isThreat?: boolean;
  correctAction?: string;
  category?: string;
}

export interface TestSession {
  sessionId?: string;
  operatorName: string;
  mode: 'NoAI' | 'WithAI';
  startTime: string;
  alertsHandledCount: number;
  totalDurationSeconds: number;
  decisions: OperatorDecision[];
}

export interface UserSession {
  token: string;
  username: string;
  email: string;
  role: string;
  databaseMode: string;
}
