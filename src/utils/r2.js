const { S3Client } = require("@aws-sdk/client-s3");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.S3_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_ID,
    secretAccessKey: process.env.S3_KEY,
  },
});

module.exports = r2;