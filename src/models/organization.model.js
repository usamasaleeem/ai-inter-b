const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const organizationSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
     slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    logo: {
      type: String,
    },
     verified: {
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
      enum: ["Applied","Invited-For-Interview", "Shortlisted", "Interviewed", "Hired", "Rejected"],
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

// Generate slug before save
// Generate slug before save
organizationSchema.pre('save', async function () {
  const org = this;
  
  if (org.isModified('password')) {
    org.password = await bcrypt.hash(org.password, 8);
  }
  
  if (org.isModified('name') && org.name) {
    const randomStr = Math.random().toString(36).substring(2, 7);
    const baseSlug = slugify(org.name, { lower: true, strict: true });
    org.slug = `${baseSlug}-${randomStr}`;
  }
});
/* =========================
   INDEXES
========================= */

/**
 * Email login lookup
 * VERY IMPORTANT
 */
organizationSchema.index(
  {
    email: 1,
  },

);

/**
 * Dashboard organization listing
 */
organizationSchema.index({
  createdAt: -1,
});

/**
 * Organization status filtering
 */
organizationSchema.index({
  status: 1,
});

/**
 * Industry filtering
 */
organizationSchema.index({
  industry: 1,
});

/**
 * Company size filtering

/**
 * Subscription plan filtering
 */


/**
 * Subscription expiry checks
 */


/**
 * Polar subscription lookup
 */


/**
 * Auto AI interview enabled orgs
 */


/**
 * Fast text search
 */
organizationSchema.index({
  name: 'text',
  email: 'text',
  industry: 'text',
});

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
