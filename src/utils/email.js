// utils/email.util.js

const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Default from email (must be verified in Resend)
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Hirel AI <info@hirelai.com>';

// Template variables replacement
const replaceTemplateVariables = (content, variables) => {
  let html = content;
  const replacements = {
    '{{name}}': variables.name || '',
    '{{interview_link}}': variables.interviewLink || '',
    '{{job_title}}': variables.jobTitle || '',
    '{{company_name}}': variables.companyName || '',
    '{{candidate_email}}': variables.candidateEmail || '',
    '{{candidate_phone}}': variables.candidatePhone || '',
    '{{interview_date}}': variables.interviewDate || '',
    '{{interview_time}}': variables.interviewTime || '',
    '{{status}}': variables.status || '',
    '{{score}}': variables.score || '',
    '{{position}}': variables.position || '',
    '{{department}}': variables.department || '',
    '{{recruiter_name}}': variables.recruiterName || '',
    '{{recruiter_email}}': variables.recruiterEmail || '',
    '{{company_website}}': variables.companyWebsite || '',
    '{{company_address}}': variables.companyAddress || '',
  };
  
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp(key, 'g'), value);
  }
  
  return html.replace(/\n/g, "<br>");
};

// Replace template variables in subject
const replaceSubjectVariables = (subject, variables) => {
  if (!subject) return '';
  
  let processedSubject = subject;
  const replacements = {
    '{{name}}': variables.name || '',
    '{{job_title}}': variables.jobTitle || '',
    '{{company_name}}': variables.companyName || '',
    '{{status}}': variables.status || '',
    '{{position}}': variables.position || '',
    '{{department}}': variables.department || '',
  };
  
  for (const [key, value] of Object.entries(replacements)) {
    processedSubject = processedSubject.replace(new RegExp(key, 'g'), value);
  }
  
  return processedSubject;
};

// Main email sender function
const sendEmail = async ({ to, subject, html, from = DEFAULT_FROM, replyTo = null }) => {
  try {
    const emailData = {
      from,
      to,
      subject,
      html,
    };
    
    // Add replyTo if provided
    if (replyTo) {
      emailData.reply_to = replyTo;
    }
    
    const { data, error } = await resend.emails.send(emailData);
    
    if (error) {
      console.error(`Resend API error for ${to}:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`Email sent to ${to}: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// Application Received Email
const sendApplicationReceivedEmail = async (candidate, job, organization, template) => {
  const interviewLink = `http://app.hirelai.com/interview/${job._id}/${candidate._id}`;
  
  const variables = {
    name: candidate.name,
    interviewLink: interviewLink,
    jobTitle: job?.title || candidate.role,
    companyName: organization.name,
    candidateEmail: candidate.email,
    candidatePhone: candidate.phone,
  };
  
  const html = replaceTemplateVariables(template.content, variables);
  const subject = replaceSubjectVariables(template.title || `Application Received: ${job?.title}`, variables);
  
  return await sendEmail({
    to: candidate.email,
    subject: subject,
    html,
  });
};

// Shortlisted Email
const sendShortlistedEmail = async (candidate, job, organization, template) => {
  const interviewLink = `http://app.hirelai.com/interview/${candidate.jobId}/${candidate._id}`;
  
  const variables = {
    name: candidate.name,
    interviewLink: interviewLink,
    jobTitle: job?.title || candidate.role,
    companyName: organization.name,
    status: 'Shortlisted',
  };
  
  const html = replaceTemplateVariables(template.content, variables);
  const subject = replaceSubjectVariables(template.title || `Congratulations! You've been Shortlisted for ${job?.title}`, variables);
  
  return await sendEmail({
    to: candidate.email,
    subject: subject,
    html,
  });
};

// Interview Invitation Email
const sendInterviewInvitationEmail = async (candidate, job, organization, template, interviewDetails = {}) => {
  const interviewLink = `http://app.hirelai.com/interview/${candidate.jobId}/${candidate._id}`;
  
  const variables = {
    name: candidate.name,
    interviewLink: interviewLink,
    jobTitle: job?.title || candidate.role,
    companyName: organization.name,
    interviewDate: interviewDetails.date,
    interviewTime: interviewDetails.time,
    recruiterName: interviewDetails.recruiterName,
    recruiterEmail: interviewDetails.recruiterEmail,
  };
  
  const html = replaceTemplateVariables(template.content, variables);
  const subject = replaceSubjectVariables(template.title || `Interview Invitation: ${job?.title} at ${organization.name}`, variables);
  
  return await sendEmail({
    to: candidate.email,
    subject: subject,
    html,
    replyTo: interviewDetails.recruiterEmail || process.env.RESEND_REPLY_TO,
  });
};

// Hired / Job Offer Email
const sendJobOfferEmail = async (candidate, job, organization, template, offerDetails = {}) => {
  const variables = {
    name: candidate.name,
    jobTitle: job?.title || candidate.role,
    companyName: organization.name,
    position: job?.title,
    department: job?.department,
    recruiterName: offerDetails.recruiterName,
    recruiterEmail: offerDetails.recruiterEmail,
    companyWebsite: organization.website,
    companyAddress: organization.address,
  };
  
  const html = replaceTemplateVariables(template.content, variables);
  const subject = replaceSubjectVariables(template.title || `Job Offer: ${job?.title} at ${organization.name}`, variables);
  
  return await sendEmail({
    to: candidate.email,
    subject: subject,
    html,
    replyTo: offerDetails.recruiterEmail,
  });
};

// Rejection Email
const sendRejectionEmail = async (candidate, job, organization, template, reason = '') => {
  const variables = {
    name: candidate.name,
    jobTitle: job?.title || candidate.role,
    companyName: organization.name,
    status: 'Rejected',
  };
  
  const html = replaceTemplateVariables(template.content, variables);
  const subject = replaceSubjectVariables(template.title || `Update on your application for ${job?.title}`, variables);
  
  return await sendEmail({
    to: candidate.email,
    subject: subject,
    html,
  });
};

// Bulk Email Sender (with rate limiting for Resend)
const sendBulkEmails = async (recipients, subject, templateContent, variables, batchSize = 10) => {
  const results = [];
  
  // Process in batches to respect rate limits
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const batchPromises = batch.map(async (recipient) => {
      const personalizedVariables = { ...variables, name: recipient.name };
      const html = replaceTemplateVariables(templateContent, personalizedVariables);
      const personalizedSubject = replaceSubjectVariables(subject, personalizedVariables);
      
      const result = await sendEmail({
        to: recipient.email,
        subject: personalizedSubject,
        html,
      });
      
      return { email: recipient.email, ...result };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
};

// Send email with attachment (Resend supports attachments)
const sendEmailWithAttachment = async ({ to, subject, html, attachment, from = DEFAULT_FROM }) => {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content, // Base64 encoded content
        },
      ],
    });
    
    if (error) {
      console.error(`Resend API error for ${to}:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`Email with attachment sent to ${to}: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error(`Failed to send email with attachment to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// Test email connection
const testEmailConnection = async () => {
  try {
    // Send a test email to verify configuration
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: 'test@resend.dev', // Resend's test email address
      subject: 'Test Email - Hirelai Email Service',
      html: '<p>Testing Resend email service! Your email configuration is working correctly.</p>',
    });
    
    if (error) {
      console.error('Resend service error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Email service (Resend) is ready');
    return { success: true };
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, error: error.message };
  }
};

// Get email status (optional - requires Resend's audit logs)
const getEmailStatus = async (messageId) => {
  try {
    // Note: Resend doesn't have a direct status endpoint yet
    // This is a placeholder for future functionality
    console.log(`Checking status for email: ${messageId}`);
    return { success: true, messageId, status: 'sent' };
  } catch (error) {
    console.error('Error getting email status:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendApplicationReceivedEmail,
  sendShortlistedEmail,
  sendInterviewInvitationEmail,
  sendJobOfferEmail,
  sendRejectionEmail,
  sendBulkEmails,
  sendEmailWithAttachment,
  testEmailConnection,
  getEmailStatus,
  replaceTemplateVariables,
  replaceSubjectVariables,
};