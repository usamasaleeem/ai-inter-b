const mongoose = require('mongoose');

const candidateSchema = mongoose.Schema(
  {

    organizationId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Organization',
      required: true,
    },
    jobId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Job',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    experienceYears: {
      type: Number,
    },
    skills: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      default: 'Applied',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },

    // AI Analysis Block
    aiAnalysis: {
      overallScore: Number,
      recommendation: {
        type: String,
      },
      summary: String,
      strengths: [String],
      weaknesses: [String],
    },

    skillsAssessment: [
      {
        skillName: String,
        level: {
          type: String,
        },
        score: Number,
      }
    ],

    performanceMetrics: {
      communication: Number,
      technicalDepth: Number,
      problemSolving: Number,
      culturalFit: Number,
    },

    transcript: String,
    recordingUrl: String,
    role: String,
        resumeUrl: String,

    tags: String,
    workExperience: [
  {
    companyName: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    employmentType: {
      type: String,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    location: {
      type: String,
    },
    description: {
      type: String, // responsibilities / achievements
    },
    technologies: {
      type: [String], // React, Node, AWS etc.
      default: [],
    },
  }
],
  },
  {
    timestamps: true,
  }
);
/* =========================
   INDEXES
========================= */

/**
 * Prevent duplicate applications
 * One email can apply only once per job
 */
candidateSchema.index(
  {
    jobId: 1,
    email: 1,
  },
  {
    unique: true,
  }
);

/**
 * Main dashboard listing
 * organization + newest candidates
 */
candidateSchema.index({
  organizationId: 1,
  appliedAt: -1,
});

/**
 * Filter candidates by status
 */
candidateSchema.index({
  organizationId: 1,
  status: 1,
});

/**
 * Filter candidates by job
 */
candidateSchema.index({
  organizationId: 1,
  jobId: 1,
});

/**
 * AI score filtering
 */
candidateSchema.index({
  organizationId: 1,
  'aiAnalysis.overallScore': 1,
});

/**
 * Fast text search
 */
candidateSchema.index({
  name: 'text',
  email: 'text',
  role: 'text',
});

/**
 * Skills filtering
 */
candidateSchema.index({
  skills: 1,
});

/**
 * Experience filtering
 */
candidateSchema.index({
  experienceYears: 1,
});

const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = Candidate;
