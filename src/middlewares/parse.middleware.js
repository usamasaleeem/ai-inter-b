const pdfParse = require("pdf-parse");

const parseResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(); // no file, skip
    }

    let extractedText = "";

    // ✅ Case 1: Using memoryStorage (BEST)
    if (req.file.buffer) {
      const data = await pdfParse(req.file.buffer);
      extractedText = data.text;
    }

    // ❗ Case 2: If using disk storage (path)
    else if (req.file.path) {
      const fs = require("fs");
      const fileBuffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(fileBuffer);
      extractedText = data.text;
    }

    // 🔥 Attach to request (important)
    req.extractedText = extractedText;
    console.log(extractedText)

    next();
  } catch (error) {
    console.error("PDF Parse Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to parse resume",
    });
  }
};

module.exports = parseResume;