const mongoose = require('mongoose');

const interviewInviteSchema = new mongoose.Schema(
  {
   

    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },

    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        'pending',
        'opened',
        'started',
        'completed',
        'expired',
        'revoked',
      ],
      default: 'pending',
    },

    

   
  },
  {
    timestamps: true,
  }
);

/* =========================
   INDEXES
========================= */

// Auto-delete expired invites


// One active invite per candidate/job
interviewInviteSchema.index(
  {
    candidateId: 1,
    jobId: 1,
    status: 1,
  }
);

module.exports = mongoose.model(
  'InterviewInvite',
  interviewInviteSchema
);