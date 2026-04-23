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
        enum: ['Strong Hire', 'Hire', 'No Hire'],
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
          enum: ['Expert', 'Advanced', 'Intermediate', 'Beginner'],
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

const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = Candidate;
