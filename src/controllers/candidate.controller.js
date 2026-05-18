const httpStatus = require('http-status').status;
const catchAsync = require('../utils/catchAsync');
const candidateService = require('../services/candidate.service');

const authService = require('../services/auth.service');
const jobService = require('../services/job.service'); // if needed for extra info
const cloudinary = require("cloudinary").v2;
const pdfParse = require('pdf-parse'); // This will now work with v1.1.1
const retellService = require('../services/retell.service');
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const emailUtil = require('../utils/email.js');
const interviewInviteModel = require('../models/interviewInvite.model.js');
const Job = require('../models/job.model.js');
const transporter = nodemailer.createTransport({
  host: "email-smtp.ap-southeast-2.amazonaws.com", // change if your region is different
  port: 465,
  secure: true,
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS,
  },
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
    // 1. Early validation - fail fast
    const { jobId, candidateData: rawCandidateData } = req.body;
    const file = req.file;

    if (!jobId) {
      return res.status(400).json({ success: false, message: "Job ID is required" });
    }

    if (!file?.buffer) {
      return res.status(400).json({ success: false, message: "No resume file uploaded" });
    }

    // 2. Parse JSON safely with error handling
    let candidateData;
    try {
      candidateData = typeof rawCandidateData === 'string' 
        ? JSON.parse(rawCandidateData) 
        : rawCandidateData;
    } catch (parseError) {
      return res.status(400).json({ success: false, message: "Invalid candidate data format" });
    }

    // 3. Parallelize independent operations (PDF parsing & Cloudinary upload)
    const [parsed, cloudinaryResult] = await Promise.all([
      pdfParse(file.buffer),
      uploadToCloudinary(file.buffer, file.originalname)
    ]);

    const extractedText = parsed.text;
    const resumeUrl = cloudinaryResult.secure_url;

    // 4. Extract work experience (consider making this non-blocking or optional)
    let workExperience = { workExperience: null };
    try {
     workExperience = await retellService.extractWorkExperience(extractedText);
    } catch (extractError) {
      console.warn('Work experience extraction failed:', extractError.message);
    }

    // 5. Create candidate and job lookup in parallel
    const [candidate, job] = await Promise.all([
      candidateService.applyToJob(jobId, {
        ...candidateData,
        resumeUrl
      }, workExperience.workExperience),
      jobService.getJobById(jobId)
    ]);

    // 6. Increment applicants count (simple atomic operation)
    await Job.findByIdAndUpdate(jobId, {
      $inc: { applicants: 1 }
    });

    // 7. Optimize token generation with better uniqueness strategy
    const token = await generateUniqueToken();

    // 8. Create interview invite
    const interviewInvite = await interviewInviteModel.create({
      candidateId: candidate._id,
      jobId: candidate.jobId || jobId,
      token,
    });

    // 9. Get organization and template in parallel
    const [organization, template] = await Promise.all([
      authService.getOrganizationProfile(job.organizationId),
      authService.getTemplateByStatus(job.organizationId, "Applied")
    ]);

    // 10. Send email asynchronously
    if (template) {
      emailUtil.sendApplicationReceivedEmail(candidate, job, token, organization, template)
        .catch(emailError => console.error('Email sending failed:', emailError));
    }

    // 11. Return response
    return res.status(httpStatus.CREATED).send({
      success: true,
      candidate,
      token,
      resumeUrl,
      extractedTextLength: extractedText.length
    });

  } catch (error) {
    console.error('Application submission error:', {
      message: error.message,
      stack: error.stack,
      body: req.body?.jobId ? { jobId: req.body.jobId } : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: "Application submission failed",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
    });
  }
});

// Helper function: Cloudinary upload
const uploadToCloudinary = (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "resumes",
        resource_type: "raw",
        public_id: `${Date.now()}-${originalname.replace(/\.[^/.]+$/, "")}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

function generateInterviewToken(length = 8) {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let token = '';

  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % chars.length];
  }

  return token;
}

// Helper function: Generate unique token efficiently
const generateUniqueToken = async () => {
  const maxAttempts = 5;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = await generateInterviewToken(8);
    const exists = await interviewInviteModel.exists({ token });
    
    if (!exists) return token;
  }
  
  // Fallback: use timestamp + random for guaranteed uniqueness
  return `${Date.now()}-${generateInterviewToken(8)}`;
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


  var interview = await interviewInviteModel.findOne({ candidateId:candidate._id,jobId:candidate.jobId });


  // 4. Send email based on status if template exists
  if (template && candidate.email) {
    let emailResult;
    
    switch (status) {
      case "Invited-For-Interview":
          if (interview) {
    interview.status = 'pending';


    await interview.save();
  }
        emailResult = await emailUtil.sendInterviewInvitationEmail(
          candidate, 
          job, 
          interview.token||'expired-invite',
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

  getCandidatesByJob,
  getCandidate,
  getCandidatesByOrg,
  updateStatus,
  applyWithResume
};
