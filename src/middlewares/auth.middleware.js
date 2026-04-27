const jwt = require('jsonwebtoken');
const httpStatus = require('http-status').status;
const config = require('../config/env');
const Organization = require('../models/organization.model');
const ApiError = require('../utils/ApiError');



const auth = async (req, res, next) => {
  console.log(req.body)
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Please authenticate');
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const organization = await Organization.findOne({ _id: decoded.sub });

    if (!organization) {
      throw new Error();
    }

    req.token = token;
    req.organization = organization;
    next();
  } catch (error) {
    next(new ApiError(401, 'Please authenticate'));
  }
};

module.exports = auth;
