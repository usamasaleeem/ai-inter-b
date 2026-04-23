

const httpStatus = require('http-status').status;
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');
const Organization = require('../models/organization.model');


const { Polar } = require("@polar-sh/sdk");

const polar = new Polar({
  accessToken: process.env.POLAR_API_KEY,
  server: "sandbox",
});

// Method 1: Direct checkout lookup (if you have the right ID)
const verifyCheckout = async (req, res) => {
  const { checkoutId } = req.body;
  console.log('Looking up checkout:', checkoutId);

  try {
    const session = await polar.checkouts.get({
      id: checkoutId,
    });
    
    console.log('Checkout found:', session.status);

    // ✅ Fix: Check for "succeeded" instead of "completed"
    if (session.status !== "succeeded") {
      return res.status(400).json({
        message: "Payment not completed",
        status: session.status,  // Will show "requires_payment_method" or "processing"
      });
    }

    // Extract organization ID from your auth
    const orgId = req.organization.id;

    // Determine plan based on product ID
    let plan = "free";
    let interviewsLimit = 5;

    // ✅ Access product ID correctly
    const productId = session.productId;  // or session.product_id
    
    if (productId === "52c3fda5-f8e3-49e7-a8d5-39cc0ffeae9b") {
      plan = "starter";  // Or "pro" based on your product
      interviewsLimit = 10;  // Match your product description
    }
    else if(productId==="7824f871-fecf-46ce-9101-83a612c0dcf0"){
  plan = "pro";  // Or "pro" based on your product
      interviewsLimit = 50;  
    }

    // ✅ Update subscription
    const updatedOrg = await Organization.findByIdAndUpdate(
      orgId,
      {
        status: "active",
        subscription: {
          plan,
          interviewsLimit,
          interviewsUsed: 0,
          startDate: new Date(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          polarCheckoutId: checkoutId,
          polarCustomerId: session.customerId,  // Store customer ID for future reference
          polarSubscriptionId: checkoutId|| null,
        },
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Account activated successfully",
      data: updatedOrg,
    });

  } catch (error) {
    console.error('Error details:', error);
    
    if (error.statusCode === 404) {
      return res.status(404).json({
        message: "Checkout session not found",
        checkoutId: checkoutId,
      });
    }
    
    return res.status(500).json({
      message: "Verification failed",
      error: error.message,
    });
  }
};

const register = catchAsync(async (req, res) => {
  console.log(req.body)
  const organization = await authService.registerOrganization({
    ...req.body,
    status:'inactive'
  });
  const transformOrg = {
    id: organization.id,
    name: organization.name,
    email: organization.email,
  };
  const tokens = authService.generateAuthTokens(organization.id);
  res.status(httpStatus.CREATED).send({ organization: transformOrg, tokens });
});

const upsertTemplate = catchAsync(async (req, res) => {
  const organizationId = req.organization.id;

  const templates = await authService.upsertTemplate(
    organizationId,
    req.body
  );

  res.status(httpStatus.OK).send({
    message: 'Template saved successfully',
    templates,
  });
});

const getTemplates = catchAsync(async (req, res) => {
  const organizationId = req.organization.id;

  const templates = await authService.getTemplates(organizationId);

  res.status(httpStatus.OK).send({
    templates,
  });
});
const getProfile = async (req, res) => {
  const org = await authService.getOrganizationProfile(req.organization.id);

  res.status(200).send({
    success: true,
    data: org,
  });
};
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const organization = await authService.loginOrganizationWithEmailAndPassword(email, password);
  const transformOrg = {
    id: organization.id,
    name: organization.name,
    email: organization.email,
  };
  const tokens = authService.generateAuthTokens(organization.id);
  res.send({ organization: transformOrg, tokens });
});

const updateProfile = async (req, res) => {
  const orgId = req.organization.id; // from JWT middleware

  const updated = await authService.updateOrganizationProfile(
    orgId,
    req.body
  );

  res.status(200).send({
    success: true,
    data: updated,
  });
};
module.exports = {
  register,
  getProfile,
  updateProfile,
  login,
  upsertTemplate,
  getTemplates,
  verifyCheckout
};
