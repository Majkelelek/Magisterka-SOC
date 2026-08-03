export interface ModelEvaluationMetrics {
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  formatAdherenceRate: number;
  averageLatencyMs: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  correctClassCount: number;
  correctActionCount: number;
  validSyntaxCount: number;
  totalRecordsTested?: number;
  classAccuracy?: number;
  actionAccuracy?: number;
  strictAccuracy?: number;
  isSkipped?: boolean;
}

export interface IndividualModelResponse {
  predictedIsThreat: boolean;
  predictedAction: string;
  predictedRisk: string;
  extractedText: string;
  isFormatValid: boolean;
  isClassCorrect: boolean;
  isActionCorrect: boolean;
  latencyMs: number;
}

export interface EvaluationItemResult {
  alertId: string;
  alertTitle: string;
  category: string;
  severity: string;
  groundTruthIsThreat: boolean;
  groundTruthAction: string;
  baseModelResponse: IndividualModelResponse;
  fineTunedModelResponse: IndividualModelResponse;
}

export interface EvaluationReport {
  reportId: string;
  timestamp: string;
  totalRecordsTested: number;
  baseModelMetrics: ModelEvaluationMetrics;
  fineTunedModelMetrics: ModelEvaluationMetrics;
  itemResults: EvaluationItemResult[];
}
