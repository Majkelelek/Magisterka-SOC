using System;
using System.Collections.Generic;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Server.Models;

[BsonIgnoreExtraElements]
public class EvaluationReport
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfDefault]
    [BsonIgnoreIfNull]
    public string? InternalId { get; set; }

    public string ReportId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public int TotalRecordsTested { get; set; }

    public ModelEvaluationMetrics BaseModelMetrics { get; set; } = new();
    public ModelEvaluationMetrics FineTunedModelMetrics { get; set; } = new();

    public List<EvaluationItemResult> ItemResults { get; set; } = new();
}

[BsonIgnoreExtraElements]
public class ModelEvaluationMetrics
{
    public string ModelName { get; set; } = string.Empty;
    public double Accuracy { get; set; }
    public double Precision { get; set; }
    public double Recall { get; set; }
    public double F1Score { get; set; }
    public double FormatAdherenceRate { get; set; }
    public double AverageLatencyMs { get; set; }

    public int TruePositives { get; set; }
    public int FalsePositives { get; set; }
    public int TrueNegatives { get; set; }
    public int FalseNegatives { get; set; }

    public int CorrectActionCount { get; set; }
    public int CorrectClassCount { get; set; }
    public int ValidSyntaxCount { get; set; }
}

[BsonIgnoreExtraElements]
public class EvaluationItemResult
{
    public string AlertId { get; set; } = string.Empty;
    public string AlertTitle { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public bool GroundTruthIsThreat { get; set; }
    public string GroundTruthAction { get; set; } = string.Empty;

    public IndividualModelResponse BaseModelResponse { get; set; } = new();
    public IndividualModelResponse FineTunedModelResponse { get; set; } = new();
}

[BsonIgnoreExtraElements]
public class IndividualModelResponse
{
    public bool PredictedIsThreat { get; set; }
    public string PredictedAction { get; set; } = string.Empty;
    public string PredictedRisk { get; set; } = string.Empty;
    public string ExtractedText { get; set; } = string.Empty;
    public bool IsFormatValid { get; set; }
    public bool IsClassCorrect { get; set; }
    public bool IsActionCorrect { get; set; }
    public long LatencyMs { get; set; }
}
