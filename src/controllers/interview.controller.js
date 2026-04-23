const httpStatus = require('http-status').status;
const catchAsync = require('../utils/catchAsync');
const Session = require('../models/session.model');
const candidateService = require('../services/candidate.service');
const jobService = require('../services/job.service');
const retellService = require('../services/retell.service');
const ApiError = require('../utils/ApiError');
const Job = require('../models/job.model');
const Organization = require('../models/organization.model');

const startInterview = catchAsync(async (req, res) => {
  const { candidateId, jobId } = req.body;
  console.log(jobId)

  // Ideally verify that candidate and job belong to the org if doing strict checks,
  // but let's assume candidate and job are public enough for candidate to start.
  // Wait, the API might be called from Frontend (candidate side) or Backend.
  // Let's assume candidate side (no auth needed for starting if they have the link, but let's do a basic lookup)

  const job = await jobService.getJobById(jobId);

    // get organization
  const organization = await Organization.findById(job.organizationId);

  if (!organization) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  // 🚫 Check interview limit
  if (
    organization.subscription.interviewsUsed >=
    organization.subscription.interviewsLimit
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Interview limit reached. Please upgrade your plan.'
    );
  }
  const candidate = await candidateService.getCandidateById(candidateId, job.organizationId);

  // create Retell Session
  const callResponse = await retellService.startCall(candidate, job);

  // create our Session DB record
  const session = await Session.create({
    candidateId,
    jobId,
    retellCallId: callResponse.callId,
    retellAgentId: callResponse.agentId,
    status: 'ongoing',
  });
    await Organization.findByIdAndUpdate(job.organizationId, {
    $inc: { 'subscription.interviewsUsed': 1 },
  });


  res.send({
    session,
    connectionDetails: callResponse,
  });
});

const endInterview = catchAsync(async (req, res) => {
  const { callId } = req.body;
  console.log(callId)

  const session = await Session.findOne({ retellCallId: callId });
  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Get mock analysis from retell end call mock

  // Update session
  session.status = 'ended';
  session.endTime = Date.now();
  await session.save();

  const job = await jobService.getJobById(session.jobId);
  const analysisData = await retellService.endCall(callId, job);

  // Save the analysis under Candidate
  await candidateService.saveInterviewAnalysis(
    session.candidateId,
    job.title,
    analysisData,
    job.organizationId
  );


  res.send({
    session,
    analysis: analysisData,
  });
});

// A webhook or secure endpoint to create agent. We'll add it here for completeness
const createJobAgent = catchAsync(async (req, res) => {
  const job = await jobService.getJobByIdAndOrganization(req.params.jobId, req.organization.id);
  const agentResponse = await retellService.createAgent(job);

  job.retellAgentId = agentResponse.agent_id;
  await job.save();

  res.send({ agentId: agentResponse.agent_id });
});

module.exports = {
  startInterview,
  endInterview,
  createJobAgent,
};
