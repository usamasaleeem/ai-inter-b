const mongoose = require('mongoose');
const httpStatus = require('http-status').status;
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
  next(new ApiError(404, 'Not found'));
};

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  
  if (!(err instanceof ApiError)) {
    statusCode = err.statusCode || err instanceof mongoose.Error ? 400 : 500;
    message = err.message || 'Internal Server Error';
    if (config.env === 'development') {
        console.error(err);
    }
  }

  const response = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).send(response);
};

module.exports = {
  notFound,
  errorHandler,
};
