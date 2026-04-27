const Candidate = require('../models/candidate.model');
const Job = require('../models/job.model');
const ApiError = require('../utils/ApiError');
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail", // or SMTP
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const applyToJob = async (jobId, candidateBody,workExperience) => {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  const existingCandidate = await Candidate.findOne({ jobId, email: candidateBody.email });
  if (existingCandidate) {
    throw new ApiError(400, 'Candidate already applied to this job');
  }

  const candidate = await Candidate.create({
    ...candidateBody,
    jobId,
    workExperience,
    organizationId: job.organizationId,
  });

  return candidate;
};

const getCandidatesByJob = async (jobId, organizationId) => {
  // Ensure the organization owns the job
  const job = await Job.findOne({ _id: jobId, organizationId });
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  const candidates = await Candidate.find({ jobId }).sort({ appliedAt: -1 });
  return candidates;
};
const getCandidatesByOrg = async (organizationId) => {
  // Ensure the organization owns the job


  const candidates = await Candidate.find({ organizationId }).sort({ appliedAt: -1 });
  return candidates;
};

const getCandidateById = async (id, organizationId) => {
  const candidate = await Candidate.findOne({ _id: id, organizationId });
  if (!candidate) {
    throw new ApiError(404, 'Candidate not found');
  }
  return candidate;
};

const updateCandidateStatus = async (id, status, organizationId) => {
  const candidate = await getCandidateById(id, organizationId);
  candidate.status = status;
  await candidate.save();
  return candidate;
};

const saveInterviewAnalysis = async (id, role, analysisData, organizationId) => {
  const candidate = await getCandidateById(id, organizationId);
  candidate.aiAnalysis = analysisData.aiAnalysis || candidate.aiAnalysis;
  candidate.skillsAssessment = analysisData.skillsAssessment || candidate.skillsAssessment;
  candidate.performanceMetrics = analysisData.performanceMetrics || candidate.performanceMetrics;
  candidate.transcript = analysisData.transcript || candidate.transcript;
  candidate.role = role;
  candidate.recordingUrl = analysisData.recordingUrl || candidate.recordingUrl;
  await candidate.save();
  return candidate;
};

module.exports = {
  applyToJob,
  getCandidatesByJob,
  getCandidateById,
  updateCandidateStatus,
  getCandidatesByOrg,
  saveInterviewAnalysis,
};
