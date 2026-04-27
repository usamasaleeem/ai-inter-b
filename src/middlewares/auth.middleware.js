const jwt = require('jsonwebtoken');
const httpStatus = require('http-status').status;
const config = require('../config/env');
const Organization = require('../models/organization.model');
const ApiError = require('../utils/ApiError');


const ALLOWED_PENDING_ROUTES = ["/checkout"];

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "No token provided");
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    const organization = await Organization.findById(decoded.sub);

    if (!organization) {
      throw new ApiError(401, "Organization not found");
    }

    // ✅ ACTIVE → allow everything
    if (organization.status === "active") {
      req.token = token;
      req.organization = organization;
      return next();
    }

    // ✅ PENDING → allow only checkout
    if (organization.status === "pending-payment") {
      const isAllowed = ALLOWED_PENDING_ROUTES.includes(req.path);

      if (!isAllowed) {
        throw new ApiError(403, "Complete payment to continue");
      }

      req.token = token;
      req.organization = organization;
      return next();
    }

    // ❌ others blocked
    throw new ApiError(403, "Account inactive");

  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, "Please authenticate"));
  }
};
module.exports = auth;
