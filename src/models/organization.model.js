const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const organizationSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logo: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      private: true, // used by a plugin if we have one to hide fields
    },
    companySize: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
      status: {
    type: String,
    default: 'inactive',
  },
subscription: {
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
  },



  interviewsLimit: {
    type: Number,
    default: 5, // free plan default
  },

  interviewsUsed: {
    type: Number,
    default: 0,
  },


  startDate: {
    type: Date,
  },

  expiryDate: {
    type: Date,
  },

  polarSubscriptionId: {
    type: String,
  },
},
     autoAiInterview: {
  type: Boolean,
  default: false, // false = manual invite, true = auto move to AI interview
},
    templates: [
  {
    status: {
      type: String,
      enum: ["Applied", "Shortlisted", "Interviewed", "Hired", "Rejected"],
      required: true,
    },
   
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
],
  },
  
  {
    timestamps: true,
  }
);

organizationSchema.pre('save', async function () {
  const org = this;
  if (org.isModified('password')) {
    org.password = await bcrypt.hash(org.password, 8);
  }
});

organizationSchema.methods.isPasswordMatch = async function (password) {
  const org = this;
  return bcrypt.compare(password, org.password);
};

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
