const httpStatus = require('http-status').status;
const catchAsync = require('../utils/catchAsync');
const Session = require('../models/session.model');
const candidateService = require('../services/candidate.service');
const jobService = require('../services/job.service');
const retellService = require('../services/retell.service');
const ApiError = require('../utils/ApiError');
const Job = require('../models/job.model');
const Organization = require('../models/organization.model');
const authService = require('../services/auth.service');

const { PutObjectCommand, CompleteMultipartUploadCommand, UploadPartCommand, CreateMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const r2 = require("../utils/r2");
const interviewInviteModel = require('../models/interviewInvite.model');

// Get presigned URL for initial chunk

// Generate 10 presigned URLs in one call
// controllers/interview.controller.js
// Keep your original working getUploadUrl - it was working fine!
// 🎯 Standalone test controller (NO req.body)




const getAllSessionVideos = async (req, res) => {
  try {
    // ✅ Dummy data
    console.log(req.body.candidate)
    const jobId = req.body.candidate.jobId;
    const candidateId = req.body.candidate._id;

    const prefix = `${jobId}/${candidateId}/`;

    // 🌐 Your public R2 base URL
    const PUBLIC_BASE_URL = "https://pub-f93361d6774644f194d023afe9bb0f23.r2.dev";

    // 📂 List all objects
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: prefix,
    });

    const data = await r2.send(listCommand);

    if (!data.Contents || data.Contents.length === 0) {
      return res.json({
        message: "No videos found",
        files: [],
      });
    }

    // 🎥 Filter + map directly to public URL
    const files = data.Contents
      .filter(obj =>
        obj.Key.endsWith(".webm") || obj.Key.endsWith(".mp4")
      )
      .map(file => ({
        key: file.Key,
        url: `${PUBLIC_BASE_URL}/${file.Key}`, // ✅ direct mapping
        size: file.Size,
        lastModified: file.LastModified,
      }));

    res.json({
      total: files.length,
      files,
    });

  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({
      error: "Failed to fetch videos",
    });
  }
};

const getUploadUrl = async (req, res) => {
  try {
    let { fileType, fileName,token, folder } = req.body;

const interview=await interviewInviteModel.findOne({token})
const candidateId=interview.candidateId
const jobId=interview.jobId
console.log(interview)
console.log(fileType)
  

    if (!fileType.startsWith("video/")) {
      return res.status(400).json({ error: "Only video uploads allowed" });
    }

    // Generate unique filename if not provided
    const extension = fileType.split("/")[1] || "webm"||'mp4';
    const finalFileName = fileName || `${Date.now()}.${extension}`;
    const key = folder ? `${folder}/${finalFileName}` : `${jobId}/${candidateId}/${finalFileName}`;

    // Simple PUT presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 3600, // 1 hour
    });
console.log(uploadUrl)
    res.json({
      uploadUrl,
      key,
      expiresIn: 3600
    });
  } catch (error) {
    console.error("Failed to generate upload URL", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
};







const startInterview = catchAsync(async (req, res) => {
  const { token } = req.body;
 
const interview=await  interviewInviteModel.findOne({token})
const candidateId=interview.candidateId
const jobId=interview.jobId
console.log(interview)

// prevent completed interview restart
if (interview.status === 'completed') {
  throw new ApiError(
    httpStatus.BAD_REQUEST,
    'Interview already completed'
  );
}

  // Delete existing folder for this job/candidate before starting new interview
  try {
    const folderPrefix = `${jobId}/${candidateId}/`;
    console.log(`Deleting existing folder: ${folderPrefix}`);
    
    // List all objects in the folder
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: folderPrefix,
    });

    const listedObjects = await r2.send(listCommand);

    if (listedObjects.Contents && listedObjects.Contents.length > 0) {
      // Prepare objects for batch deletion
      const objectsToDelete = listedObjects.Contents.map(obj => ({ Key: obj.Key }));
      
      // Delete in batches of 1000 (R2/S3 limit)
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: process.env.S3_BUCKET,
        Delete: {
          Objects: objectsToDelete,
          Quiet: false,
        },
      });

      const deleteResult = await r2.send(deleteCommand);
      console.log(`Deleted ${deleteResult.Deleted?.length || 0} existing files for ${folderPrefix}`);
      
      if (deleteResult.Errors && deleteResult.Errors.length > 0) {
        console.error('Errors during deletion:', deleteResult.Errors);
      }
    } else {
      console.log(`No existing files found for ${folderPrefix}`);
    }
  } catch (deleteError) {
    console.error('Error deleting existing folder:', deleteError);
    // Continue with interview creation even if deletion fails
  }


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
  const { token } = req.body;
  console.log(req.body)


const interview = await interviewInviteModel.findOne({ token });
  const job = await jobService.getJobById(interview.jobId);
  
  const candidate = await candidateService.updateCandidateStatus(
    interview.candidateId,
    'Interviewed',
    job.organizationId
  );
  console.log(candidate);
const status='Interviewed'
  // 2. Get the job detailss

  // 3. Get matching template based on status
  const template = await authService.getTemplateByStatus(
    req.organization.id,
    'Interviewed'
  );

    if (template && candidate.email) {
    let emailResult;
    
    switch (status) {
      
      case "Interviewed":
        // You might want to send a post-interview feedback email
        emailResult = await emailUtil.sendEmail({
          to: candidate.email,
          subject: template.title || `Interview Update: ${job?.title}`,
          html: emailUtil.replaceTemplateVariables(template.content, {
            name: candidate.name,
            jobTitle: job?.title,
            companyName: req.organization.name,
            status: "Interviewed",
            interviewDate: interviewDetails.date,
            interviewTime: interviewDetails.time,
          }),
        });
        break;
     
    }
    
    if (!emailResult.success) {
      console.error(`Failed to send ${status} email to ${candidate.email}:`, emailResult.error);
    }
  } else if (!template) {
    console.warn(`No template found for status: ${status}`);
  }
if (!interview) {
  throw new Error('Interview not found');
}

interview.status = 'completed';





await interview.save();
  // Get mock analysis from retell end call mock


 

  res.send({
    sucess: true,
  });
});

const endInterviewWebhook = catchAsync(async (req, res) => {
  console.log(req.body)
  const { transcript,call_id,recording_url } = req.body.call;
  console.log(req.body)

  const session = await Session.findOne({ retellCallId: call_id });
  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Get mock analysis from retell end call mock

  // Update session
  session.status = 'ended';
  session.endTime = Date.now();
  await session.save();

  const job = await jobService.getJobById(session.jobId);
  var analysisData = await retellService.endCall(transcript, job);
analysisData.recordingUrl=recording_url
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
  createJobAgent,getUploadUrl,
  getAllSessionVideos,
  endInterviewWebhook
};
