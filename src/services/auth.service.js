const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const Organization = require('../models/organization.model');
const ApiError = require('../utils/ApiError');

const registerOrganization = async (orgBody) => {
  if (await Organization.findOne({ email: orgBody.email })) {
    throw new ApiError(400, 'Email already taken');
  }
  const org = await Organization.create(orgBody);
  return org;
};
const getTemplates = async (organizationId) => {
  const organization = await Organization.findById(organizationId);

  if (!organization) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  // 🔥 Group templates by status (matches your frontend)
  const grouped = {
    Applied: [],
    Shortlisted: [],
    Interviewed: [],
    Hired: [],
    Rejected: [],
  };

  organization.templates.forEach((tpl) => {
    if (!grouped[tpl.status]) {
      grouped[tpl.status] = [];
    }
    grouped[tpl.status].push(tpl);
  });

  return grouped;
};
const getTemplateByStatus = async (organizationId, status) => {
  const organization = await Organization.findById(organizationId);

  if (!organization) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  const template = organization.templates.find(
    (tpl) => tpl.status === status
  );

  return template || null;
};
const upsertTemplate = async (organizationId, body) => {
  const { status, title, content } = body;

  const organization = await Organization.findById(organizationId);

  if (!organization) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  const existingIndex = organization.templates.findIndex(
    (tpl) => tpl.status === status
  );

  if (existingIndex !== -1) {
    // ✏️ Update existing template
    organization.templates[existingIndex].title = title;
    organization.templates[existingIndex].content = content;
  } else {
    // ➕ Create new template
    organization.templates.push({
      status,
      title,
      content,
    });
  }

  await organization.save();

  return organization.templates;
};

const getOrganizationProfile = async (organizationId) => {
  const organization = await Organization.findById(organizationId)
    .select('-password') // 🔒 exclude sensitive data
    .lean();

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }

  // Optional: structure templates like your frontend expects
  const groupedTemplates = {
    Applied: [],
    Shortlisted: [],
    Interviewed: [],
    Hired: [],
    Rejected: [],
  };

  if (organization.templates && organization.templates.length > 0) {
    organization.templates.forEach((tpl) => {
      if (!groupedTemplates[tpl.status]) {
        groupedTemplates[tpl.status] = [];
      }
      groupedTemplates[tpl.status].push(tpl);
    });
  }

  return {
    ...organization,
    templatesGrouped: groupedTemplates, // 🔥 extra structured data
  };
};
const loginOrganizationWithEmailAndPassword = async (email, password) => {
  const org = await Organization.findOne({ email });

  if (!org) {
    throw new ApiError(401, 'Incorrect email or password');
  }

  // 🔴 Check status first
  if (org.status !== 'active') {
    throw new ApiError(403, 'Your account is inactive. Please contact support.');
  }

  // 🔐 Check password
  if (!(await org.isPasswordMatch(password))) {
    throw new ApiError(401, 'Incorrect email or password');
  }

  return org;
};

const generateAuthTokens = (orgId) => {
  const accessTokenExpires = Math.floor(Date.now() / 1000) + (config.jwt.accessExpirationMinutes * 60);
  const payload = {
    sub: orgId,
    iat: Math.floor(Date.now() / 1000),
    exp: accessTokenExpires,
  };
  
  const accessToken = jwt.sign(payload, config.jwt.secret);
  return {
    access: {
      token: accessToken,
      expires: new Date(accessTokenExpires * 1000),
    },
  };
};
const updateOrganizationProfile = async (organizationId, updateBody) => {
  const { name, industry, autoAiInterview } = updateBody;

  const organization = await Organization.findById(organizationId);

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }

  // ✅ Only allow safe fields
  if (name !== undefined) {
    organization.name = name;
  }

  if (industry !== undefined) {
    organization.industry = industry;
  }

  if (autoAiInterview !== undefined) {
    organization.autoAiInterview = autoAiInterview;
  }

  await organization.save();

  // 🔒 remove password before returning
  const orgObj = organization.toObject();
  delete orgObj.password;

  return orgObj;
};

module.exports = {
  getTemplateByStatus,
  getOrganizationProfile,
  registerOrganization,
  loginOrganizationWithEmailAndPassword,
  updateOrganizationProfile,
  generateAuthTokens,upsertTemplate,getTemplates
};
