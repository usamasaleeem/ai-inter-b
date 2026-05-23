const Job = require('../models/job.model');
const ApiError = require('../utils/ApiError');
const { createAgent, updateAgentLLM } = require('./retell.service');

const createJob = async (jobBody, organizationId) => {
  let agent = null;
  let systemPrompt = null;

  // Skip agent creation if organizationId is 123
  if (organizationId !== "6a1174d4068d7779bbe77294") {
    const agentData = await createAgent(jobBody);

    agent = agentData.agent;
    systemPrompt = agentData.systemPrompt;
  }

  // Create job
  const job = await Job.create({
    ...jobBody,
    organizationId,
    prompt: systemPrompt,
    llmId: agent?.response_engine?.llm_id || null,
    agentid: agent?.agent_id || null,
  });

  return job;
};

const queryJobsByOrganization = async (organizationId) => {
  const jobs = await Job.find({ organizationId }).sort({ createdAt: -1 });
  return jobs;
};

const getJobByIdAndOrganization = async (id, organizationId) => {

  const job = await Job.findOne({ _id: id, organizationId });
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }
  return job;
};

const getJobById = async (id) => {
  const job = await Job.findById(id);
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }
  return job;
};

const updateJobById = async (id, updateBody, organizationId) => {
  const job = await getJobByIdAndOrganization(id, organizationId);

  const LLM_FIELDS = [
    'title',
    'description',
    'skills',
    'interviewType',
    'questions',
  ];
  const isLLMUpdated = LLM_FIELDS.some((field) => {
    return (
      updateBody[field] !== undefined &&
      JSON.stringify(updateBody[field]) !== JSON.stringify(job[field])
    );
  });
  if (isLLMUpdated && job.agentid) {
    const updatedData = { ...job.toObject(), ...updateBody };

    await updateAgentLLM(job, updatedData);
  }

  Object.assign(job, updateBody);
  await job.save();
  return job;
};

const deleteJobById = async (id, organizationId) => {
  const job = await getJobByIdAndOrganization(id, organizationId);
  await job.deleteOne();
  return job;
};

const publishJob = async (id, organizationId) => {
  const job = await getJobByIdAndOrganization(id, organizationId);
  job.status = 'Published';
  await job.save();
  return job;
};

const draftJob = async (id, organizationId) => {
  const job = await getJobByIdAndOrganization(id, organizationId);
  job.status = 'Draft';
  await job.save();
  return job;
};
const incrementApplicantsCount = async (jobId, session = null) => {
  const options = { new: true };
  if (session) options.session = session;
  
  const job = await Job.findByIdAndUpdate(
    jobId,
    { 
      $inc: { applicants: 1 },
    
    },
    options
  );
  
  if (!job) {
    throw new Error('Job not found');
  }
  
  return job;
};
module.exports = {
  incrementApplicantsCount,
  createJob,
  queryJobsByOrganization,
  getJobByIdAndOrganization,
  getJobById,
  updateJobById,
  deleteJobById,
  publishJob,
  draftJob,
};
