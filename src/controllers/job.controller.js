const httpStatus = require('http-status').status;
const catchAsync = require('../utils/catchAsync');
const jobService = require('../services/job.service');
const authService = require('../services/auth.service');

const createJob = catchAsync(async (req, res) => {
  console.log(req.body)
  const job = await jobService.createJob(req.body, req.organization.id);
  res.status(httpStatus.CREATED).send(job);
});

const getJobs = catchAsync(async (req, res) => {
  const jobs = await jobService.queryJobsByOrganization(req.organization.id);
  res.send(jobs);
});

const getJob = catchAsync(async (req, res) => {
  console.log(req)
  const job = await jobService.getJobByIdAndOrganization(req.params.id, req.organization.id);
  res.send(job);
});
const getPublicJob = catchAsync(async (req, res) => {
  const job = await jobService.getJobById(req.params.id);

  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  const org = await authService.getOrganizationProfile(job.organizationId);

  // 🔥 attach only what you need
  const jobObj = job.toObject ? job.toObject() : job;

  res.send({
    ...jobObj,
    autoAiInterview: org.autoAiInterview || false,
  });
});

const updateJob = catchAsync(async (req, res) => {
  const job = await jobService.updateJobById(req.params.id, req.body, req.organization.id);
  res.send(job);
});

const deleteJob = catchAsync(async (req, res) => {
  await jobService.deleteJobById(req.params.id, req.organization.id);
  res.status(httpStatus.NO_CONTENT).send();
});

const publishJob = catchAsync(async (req, res) => {
  const job = await jobService.publishJob(req.params.id, req.organization.id);
  res.send(job);
});

const draftJob = catchAsync(async (req, res) => {
  const job = await jobService.draftJob(req.params.id, req.organization.id);
  res.send(job);
});

module.exports = {
  createJob,
  getJobs,
  getJob,
  updateJob,
  deleteJob,
  publishJob,
  draftJob,
  getPublicJob
};
