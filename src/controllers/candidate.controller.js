const httpStatus = require('http-status').status;
const catchAsync = require('../utils/catchAsync');
const candidateService = require('../services/candidate.service');

const authService = require('../services/auth.service');
const jobService = require('../services/job.service'); // if needed for extra info
const cloudinary = require("cloudinary").v2;
const pdfParse = require('pdf-parse'); // This will now work with v1.1.1
const retellService = require('../services/retell.service');
const nodemailer = require("nodemailer");
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
  const { jobId,resumeContent, ...candidateBody } = req.body;
      const workExperience = await retellService.extractWorkExperience(resumeContent);
console.log(workExperience.workExperience)
  const candidate = await candidateService.applyToJob(jobId, candidateBody,workExperience.workExperience);

  console.log('created')
  res.status(httpStatus.CREATED).send(candidate);
});

// the following require auth (organization)
const getCandidatesByJob = catchAsync(async (req, res) => {
  const candidates = await candidateService.getCandidatesByJob(req.params.jobId, req.organization.id);
  res.send(candidates);
});
const getCandidatesByOrg = catchAsync(async (req, res) => {
  const candidates = await candidateService.getCandidatesByOrg(req.organization.id);
  res.send(candidates);
});

const getCandidate = catchAsync(async (req, res) => {
  const candidate = await candidateService.getCandidateById(req.params.id, req.organization.id);

  res.send(candidate);
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
  const { status, email } = req.body;

  // 1. Update candidate
  const candidate = await candidateService.updateCandidateStatus(
    req.params.id,
    status,
    req.organization.id
  );
console.log(candidate)

  // 2. Get matching template
  const template = await authService.getTemplateByStatus(
    req.organization.id,
    status
  );
console.log(template)
let html = template.content;
const interviewLink = `http://localhost:5173/interview/${candidate.jobId}/${candidate._id}`;
html = html
  .replace(/{{name}}/g, candidate.name || "")
  .replace(/{{interview_link}}/g, interviewLink)
  .replace(/{{job_title}}/g, candidate.role || "")
  .replace(/{{company_name}}/g, "Routox LLC");
html = html.replace(/\n/g, "<br>");
  // 3. Send email if template exists
  if (template) {
    await transporter.sendMail({
      from: 'info@hirelai.com',
      to: 'itsoxama@gmail.com',
      subject: template.title || `Update regarding your application`,
      html: html|| `<p>Status updated to ${status}</p>`,
    });
  }

  res.send(candidate);
});

module.exports = {
  apply,
  getCandidatesByJob,
  getCandidate,
  getCandidatesByOrg,
  updateStatus,
  uploadResumeController
};
