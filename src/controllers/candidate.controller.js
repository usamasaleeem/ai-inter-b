const httpStatus = require('http-status').status;
const catchAsync = require('../utils/catchAsync');
const candidateService = require('../services/candidate.service');

const authService = require('../services/auth.service');
const jobService = require('../services/job.service'); // if needed for extra info
const cloudinary = require("cloudinary").v2;
const pdfParse = require('pdf-parse'); // This will now work with v1.1.1
const retellService = require('../services/retell.service');
const nodemailer = require("nodemailer");

const emailUtil = require('../utils/email.js');
const transporter = nodemailer.createTransport({
  host: "email-smtp.ap-southeast-2.amazonaws.com", // change if your region is different
  port: 465,
  secure: true,
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS,
  },
});





const apply = catchAsync(async (req, res) => {
  const { jobId, resumeContent, ...candidateBody } = req.body;
  const workExperience = await retellService.extractWorkExperience(resumeContent);
  console.log(workExperience.workExperience);
  
  const candidate = await candidateService.applyToJob(jobId, candidateBody, workExperience.workExperience);
  const job = await jobService.getJobById(jobId);
  
  // Get organization using job's organization ID
  const organization = await authService.getOrganizationProfile(job.organizationId);
    console.log(organization)
  const template = await authService.getTemplateByStatus(organization._id, "Invited-For-Interview");
  console.log(template)
  if (template) {
    await emailUtil.sendApplicationReceivedEmail(candidate, job, organization, template);
  }
  
  console.log('created');
  res.status(httpStatus.CREATED).send(candidate);
});

// the following require auth (organization)
const getCandidatesByJob = catchAsync(async (req, res) => {
  const candidates = await candidateService.getCandidatesByJob(req.params.jobId, req.organization.id);
  res.send(candidates);
});
const getCandidatesByOrg = catchAsync(async (req, res) => {
  const page = parseInt(req.body.page) || 1;
   const filter = req.body.filter ;
  const limit = parseInt(req.body.limit) || 10;
  
  const result = await candidateService.getCandidatesByOrg(
    req.organization.id,
    page,
    limit,
    filter
  );
  
  res.json({
    success: true,
    data: result.candidates,
    pagination: {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      limit: result.limit
    }
  });
});

const getCandidate = catchAsync(async (req, res) => {
  const candidate = await candidateService.getCandidateById(req.params.id, req.organization.id);

  res.send(candidate);
});

const applyWithResume = catchAsync(async (req, res) => {
  try {
    console.log(req.body)
    var { jobId, candidateData } = req.body;
     candidateData=JSON.parse(candidateData)
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({ message: "No resume file uploaded" });
    }

    // Parse PDF from buffer
    const parsed = await pdfParse(file.buffer);
    const extractedText = parsed.text;

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "resumes",
          resource_type: "raw",
          public_id: Date.now() + "-" + file.originalname.replace(/\.[^/.]+$/, ""),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });

    // Extract work experience from resume
    const workExperience = await retellService.extractWorkExperience(extractedText);
    
    // Create candidate with extracted data
    const candidate = await candidateService.applyToJob(
      jobId, 
      {
        ...candidateData,
        resumeUrl: result.secure_url
      }, 
      workExperience.workExperience
    );
    
    const job = await jobService.getJobById(jobId);
    const organization = await authService.getOrganizationProfile(job.organizationId);
    const template = await authService.getTemplateByStatus(organization._id, "Invited-For-Interview");
    
    if (template) {
      await emailUtil.sendApplicationReceivedEmail(candidate, job, organization, template);
    }
    
    res.status(httpStatus.CREATED).send({
      success: true,
      candidate,
      resumeUrl: result.secure_url,
      extractedTextLength: extractedText.length
    });
    
  } catch (error) {
    console.error('Application submission error:', error);
    return res.status(500).json({
      success: false,
      message: "Application submission failed",
      error: error.message
    });
  }
});






const uploadResumeController = async (req, res) => {
  try {
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log('File received:', file.originalname, 'Size:', file.buffer.length);
    console.log('pdfParse type:', typeof pdfParse); // Should log 'function'

    // Parse PDF from buffer
    const parsed = await pdfParse(file.buffer);
    const extractedText = parsed.text;
   
    console.log('PDF parsed successfully, text length:', extractedText.length);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "resumes",
          resource_type: "raw",
          public_id: Date.now() + "-" + file.originalname.replace(/\.[^/.]+$/, ""),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });

    return res.json({
      success: true,
      url: result.secure_url,
      text: extractedText,
      textLength: extractedText.length
    });
    
  } catch (error) {
    console.error('Upload error details:', error);
    return res.status(500).json({
      success: false,
      message: "Upload + parsing failed",
      error: error.message
    });
  }
};

const updateStatus = catchAsync(async (req, res) => {
  const { status, email, interviewDetails = {} } = req.body;

  // 1. Update candidate
  const candidate = await candidateService.updateCandidateStatus(
    req.params.id,
    status,
    req.organization.id
  );
  console.log(candidate);

  // 2. Get the job detailss
  const job = await jobService.getJobById(candidate.jobId);
  
  // 3. Get matching template based on status
  const template = await authService.getTemplateByStatus(
    req.organization.id,
    status
  );
  console.log(template);
 
  // 4. Send email based on status if template exists
  if (template && candidate.email) {
    let emailResult;
    
    switch (status) {
      case "Invited-For-Interview":
        emailResult = await emailUtil.sendInterviewInvitationEmail(
          candidate, 
          job, 
          req.organization, 
          template, 
          interviewDetails
        );
        break;
        
      case "Shortlisted":
        emailResult = await emailUtil.sendShortlistedEmail(
          candidate, 
          job, 
          req.organization, 
          template
        );
        break;
        
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
        
      case "Hired":
        emailResult = await emailUtil.sendJobOfferEmail(
          candidate, 
          job, 
          req.organization, 
          template, 
          interviewDetails
        );
        break;
        
      case "Rejected":
        emailResult = await emailUtil.sendRejectionEmail(
          candidate, 
          job, 
          req.organization, 
          template,
          interviewDetails.reason || ''
        );
        break;
        
      case "Applied":
      default:
        emailResult = await emailUtil.sendApplicationReceivedEmail(
          candidate, 
          job, 
          req.organization, 
          template
        );
        break;
    }
    
    if (!emailResult.success) {
      console.error(`Failed to send ${status} email to ${candidate.email}:`, emailResult.error);
    }
  } else if (!template) {
    console.warn(`No template found for status: ${status}`);
  }

  res.send(candidate);
});
module.exports = {
  apply,
  getCandidatesByJob,
  getCandidate,
  getCandidatesByOrg,
  updateStatus,
  uploadResumeController,
  applyWithResume
};
