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

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
