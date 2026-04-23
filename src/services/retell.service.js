const config = require('../config/env');
const Retell = require('retell-sdk');
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const retellClient = new Retell({
  apiKey: config.retell.apiKey,
});


const generateSystemPrompt = (job) => {
  return `You are a professional AI Interviewer for the role of ${job.title}. 
The interview will be ${job.interviewType} focused.
The candidate needs to have experience level: ${job.experienceLevel}.
Ask questions from the following list: ${job.questions.join(', ')}.
Evaluate their skills on: ${job.skills.join(', ')}.
Be polite, professional, and objective.
Descrption:  ${job.description}
Time Limit 20 minutes
`;
};

const updateAgentLLM = async (jobData, updateddata) => {
  try {
    if (!jobData.llmId) {
      throw new Error("Missing llmId for update");
    }

    const prompt = generateSystemPrompt(updateddata);

    const updatedLLM = await retellClient.llm.update(jobData.llmId, {
      general_prompt: prompt,
    });

    return updatedLLM;
  } catch (error) {
    console.error(
      "Failed to update Retell LLM",
      error.response?.data || error
    );
    throw new Error("Retell API error: updateAgentLLM");
  }
};
const createAgent = async (jobData) => {
  try {
    var prompt = generateSystemPrompt(jobData)
    const conversationFlowResponse = await retellClient.llm.create({
      model: 'gpt-4.1-nano',
      general_prompt: prompt,
    });

    const agent = await retellClient.agent.create({
      agent_name: `Interviewer for ${jobData.title}`,
      voice_id: 'retell-Cimo',

      response_engine: {
        type: "retell-llm",
        llm_id: conversationFlowResponse.llm_id
      },
    });
    console.log(agent)

    return agent;

  } catch (error) {
    console.error('Failed to create Retell Agent', error.response?.data || error);
    throw new Error('Retell API error: createAgent');
  }
};

const startCall = async (candidate, job) => {
  try {
    const agentId = job.agentid;
    console.log(job)

    const callResponse = await retellClient.call.createWebCall({
      agent_id: agentId,

    });

    return {
      callId: callResponse.call_id,
      accessToken: callResponse.access_token,
      wsUrl: callResponse.websocket_url, // IMPORTANT for frontend
    };
  } catch (error) {
    console.error('Failed to start Retell Call', error.response?.data || error);
    throw new Error('Retell API error: startCall');
  }
};

const analyzeInterview = async (transcript, job) => {
  const prompt = `
Analyze this interview for:
Role: ${job.title}
Skills: ${job.skills.join(', ')}

Return STRICT JSON:

{
  "overallScore": number,
  "recommendation": "Strong Hire" | "Hire" | "No Hire",
  "summary": string,
  "strengths": [string],
  "weaknesses": [string],
  "skillsAssessment": [
    {
      "skillName": string,
      "level": "Expert" | "Advanced" | "Intermediate" | "Beginner",
      "score": number
    }
  ],
  "performanceMetrics": {
    "communication": number,
    "technicalDepth": number,
    "problemSolving": number,
    "culturalFit": number
  }
}

Transcript:
${transcript}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      { role: "system", content: "You are an expert technical interviewer." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
  });

  let text = completion.choices[0].message.content;

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON parse error:", text);
    throw new Error("Invalid JSON from AI");
  }
};
const extractWorkExperience = async (resumeText) => {
  const prompt = `
Extract ONLY the work experience from this resume.

Return STRICT JSON in this exact format:

{
  "workExperience": [
    {
      "companyName": string,
      "jobTitle": string,
      "employmentType": "Full-time" | "Part-time" | "Contract" | "Internship" | "Freelance" | null,
      "startDate": string, // ISO format YYYY-MM-DD or null
      "endDate": string, // ISO format YYYY-MM-DD or null (null if current)
      "location": string,
      "description": string,
      "technologies": [string]
    }
  ]
}

Rules:
- Do NOT include anything except workExperience
- Dates must be ISO format (YYYY-MM-DD) if possible
- If missing, return null
- Extract technologies like React, Node.js, AWS, MongoDB, etc.
- Description should summarize responsibilities + achievements
- Remove duplicates
- Keep clean structured output

Resume:
${resumeText}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini", // better than nano for structured extraction
    messages: [
      {
        role: "system",
        content: "You are an expert resume parser. Extract only structured work experience.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  let text = completion.choices[0].message.content;

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON parse error:", text);
    throw new Error("Invalid JSON from AI");
  }
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const endCall = async (callId, job) => {
  const MAX_RETRIES = 6;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Fetch full call details
      const call = await retellClient.call.retrieve(callId);

      // 🛑 If transcript not ready → retry
      if (!call?.transcript) {
        console.log(`Transcript not ready. Retry ${attempt + 1}/${MAX_RETRIES}`);
        await wait(2000 * Math.pow(2, attempt)); // exponential backoff
        continue;
      }

      const analysis = await analyzeInterview(call.transcript, job);

      // 🛑 If analysis not valid → retry
      if (!analysis || !analysis.overallScore) {
        console.log(`Analysis not ready. Retry ${attempt + 1}/${MAX_RETRIES}`);
        await wait(2000 * Math.pow(2, attempt));
        continue;
      }

      // ✅ Success
      return {
        transcript: call.transcript,

        aiAnalysis: {
          overallScore: analysis.overallScore,
          recommendation: analysis.recommendation,
          summary: analysis.summary,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
        },
        skillsAssessment: analysis.skillsAssessment,
        performanceMetrics: analysis.performanceMetrics,
        recordingUrl: call.recording_url,
      };

    } catch (error) {
      console.error(
        `Attempt ${attempt + 1} failed`,
        error.response?.data || error
      );

      await wait(2000 * Math.pow(2, attempt));
    }
  }

  throw new Error('Retell API error: analysis not available after retries');
};

module.exports = {
  createAgent,
  updateAgentLLM,
  startCall,
  extractWorkExperience,
  endCall,
};