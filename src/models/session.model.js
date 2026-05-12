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

/* =========================
   INDEXES
========================= */

/**
 * Candidate session lookup
 */
sessionSchema.index({
  candidateId: 1,
});

/**
 * Job session listing
 */
sessionSchema.index({
  jobId: 1,
  createdAt: -1,
});

/**
 * Session status filtering
 */
sessionSchema.index({
  status: 1,
});

/**
 * Retell call webhook lookup
 * VERY IMPORTANT
 */
sessionSchema.index(
  {
    retellCallId: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

/**
 * Retell agent filtering
 */


/**
 * Candidate + job lookup
 */
sessionSchema.index({
  candidateId: 1,
  jobId: 1,
});

/**
 * Active sessions
 */
sessionSchema.index({
  status: 1,
  startTime: -1,
});

/**
 * Cleanup old sessions / analytics
 */
sessionSchema.index({
  createdAt: -1,
});
const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
