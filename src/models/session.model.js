const mongoose = require('mongoose');

const sessionSchema = mongoose.Schema(
  {
    candidateId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Candidate',

    },
    jobId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Job',
      required: true,
    },
    retellCallId: {
      type: String,
      trim: true,
    },
    retellAgentId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['started', 'ongoing', 'ended'],
      default: 'started',
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
