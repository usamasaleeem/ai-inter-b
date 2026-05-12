const mongoose = require('mongoose');

const jobSchema = mongoose.Schema(
  {
    organizationId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Organization',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    agentid: {
      type: String,
    },
     prompt: {
      type: String,
    },
    llmId: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    salaryRange: {
      type: String,
    },
    experienceLevel: {
      type: String,
      required: true,
    },
    interviewType: {
      type: String,
      required: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    questions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      default: 'Draft',
    },
  },
  {
    timestamps: true,
  }
);




/* =========================
   INDEXES
========================= */

/**
 * Main dashboard listing
 * Organization jobs sorted newest first
 */
jobSchema.index({
  organizationId: 1,
  createdAt: -1,
});

/**
 * Filter jobs by status
 */
jobSchema.index({
  organizationId: 1,
  status: 1,
});

/**
 * Filter jobs by experience level
 */
jobSchema.index({
  organizationId: 1,
  experienceLevel: 1,
});

/**
 * Filter jobs by interview type
 */
jobSchema.index({
  organizationId: 1,
  interviewType: 1,
});

/**
 * Fast title search
 */
jobSchema.index({
  title: 'text',
  description: 'text',
  skills: 'text',
});

/**
 * Skills filtering
 */
jobSchema.index({
  skills: 1,
});

/**
 * Agent lookup
 */


const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
