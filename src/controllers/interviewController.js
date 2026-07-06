const axios = require('axios')
const Interview = require('../models/interview')

function buildFallbackQuestions(role = 'developer', experience = '2', difficulty = 'medium', techStack = '') {
  const roleName = role || 'developer'
  const experienceText = experience || '2'
  const difficultyText = difficulty || 'medium'
  const techText = techStack ? ` using ${techStack}` : ''

  const templates = [
    `Tell me about your experience as a ${roleName} developer${techText}.`,
    `How would you explain your approach to solving a difficult problem in ${roleName} development?`,
    `What would you do if a feature was not working in production?`,
    `How do you keep your code clean and easy to maintain in a ${difficultyText} level project?`,
    `What are the most important things you check before deploying an application?`,
    `Describe a project where you used ${techStack || 'modern web tools'} and what you learned from it.`,
    `How would you improve the performance of an application with ${experienceText} years of experience?`
  ]

  return templates.map((question) => ({ question }))
}

function normalizeQuestionsResponse(rawText, fallbackQuestions = []) {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackQuestions
  }

  let cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed

  try {
    parsed = JSON.parse(cleaned)
  } catch (error) {
    const firstBracket = cleaned.indexOf('[')
    const lastBracket = cleaned.lastIndexOf(']')

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const sliced = cleaned.slice(firstBracket, lastBracket + 1)

      try {
        parsed = JSON.parse(sliced.replace(/,\s*([}\]])/g, '$1'))
      } catch {
        parsed = null
      }
    }
  }

  if (Array.isArray(parsed)) {
    if (parsed.every((item) => item && typeof item === 'object' && typeof item.question === 'string')) {
      return parsed
    }

    const normalized = []
    for (const item of parsed) {
      if (typeof item === 'string') {
        try {
          const obj = JSON.parse(item)
          if (obj && typeof obj.question === 'string') {
            normalized.push(obj)
          }
        } catch {
          normalized.push({ question: item })
        }
      } else if (item && typeof item === 'object' && typeof item.question === 'string') {
        normalized.push(item)
      }
    }

    if (normalized.length > 0) {
      return normalized
    }
  }

  const questionMatches = [...cleaned.matchAll(/"question"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
  const extractedQuestions = questionMatches
    .map((match) => {
      try {
        return { question: JSON.parse(`"${match[1]}"`) }
      } catch {
        return null
      }
    })
    .filter(Boolean)

  if (extractedQuestions.length > 0) {
    return extractedQuestions
  }

  return fallbackQuestions.length > 0 ? fallbackQuestions : []
}

function parseScoreValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(10, value > 10 ? value / 10 : value))
  }

  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:\.\d+)?)/)
    if (match) {
      const parsed = Number(match[1])
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(10, parsed > 10 ? parsed / 10 : parsed))
      }
    }
  }

  return null
}

function buildFallbackEvaluation(answers = []) {
  const safeAnswers = Array.isArray(answers) ? answers : []
  const results = safeAnswers.map((item, index) => {
    const answerText = typeof item?.answer === 'string' ? item.answer : ''
    const trimmed = answerText.trim()
    const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
    const hasTechnicalContent = /\b(api|database|mongodb|node|express|react|javascript|typescript|deployment|debug|testing|docker|git|authentication|server|frontend|backend|service|system|algorithm|architecture)\b/i.test(trimmed)
    const score = wordCount >= 8 ? (hasTechnicalContent ? 8 : 7) : (trimmed ? 6 : 4)

    return {
      question: item?.question || `Answer ${index + 1}`,
      answer: answerText,
      score: `${score}/10`,
      overAllFeedback: trimmed ? 'Answer provided with useful detail.' : 'Please provide a more complete response.'
    }
  })

  const totalScore = results.reduce((sum, item) => sum + (parseScoreValue(item.score) || 0), 0)
  const averageScore = results.length > 0 ? totalScore / results.length : 0

  return {
    results,
    overAllFeedback: 'Evaluation completed with fallback scoring because the AI service was unavailable.',
    improvements: ['Add concrete examples and explain trade-offs clearly.'],
    finalRating: averageScore >= 8 ? 'A' : averageScore >= 6 ? 'B' : averageScore >= 4 ? 'C' : 'D'
  }
}

async function callAiModel(prompt) {
  const aiUrl = process.env.AI_API_URL || process.env.OLLAMA_URL || 'http://localhost:11434/api/generate'
  const aiModel = process.env.AI_MODEL || 'qwen2.5:3b'

  try {
    const response = await axios.post(aiUrl, {
      model: aiModel,
      prompt,
      stream: false,
    }, {
      timeout: 30000
    })

    return response?.data?.response || response?.data?.choices?.[0]?.message?.content || response?.data?.output_text || ''
  } catch (error) {
    console.error('AI request failed:', error.message)
    return ''
  }
}

//  CREATE INTERVIEW
async function createInterview(req, res) {
  try {
    const { jobRole, experience } = req.body

    const newInterview = await Interview.create({
      jobRole,
      experience
    })

    res.status(200).json({ interviewId: newInterview._id })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
  
}


//  GENERATE QUESTIONS & SAVE IN SAME INTERVIEW
async function generateQuestions(req, res) {
  try {
    const {
      role,
      experience,
      techStack,
      difficulty,
      numberOfQuestions,
      interviewId
    } = req.body

    const prompt = `
You are a technical interviewer.
Generate ${numberOfQuestions} ${difficulty} level interview questions for a ${role} developer with ${experience} years of experience.

Tech stack: ${techStack}

Return ONLY JSON array:
[{
 "question":"string"
}]
`

    const rawText = await callAiModel(prompt)
    const fallbackQuestions = buildFallbackQuestions(role, experience, difficulty, techStack)
    const questionsArray = normalizeQuestionsResponse(rawText, fallbackQuestions)

    const limitedQuestions = questionsArray.slice(0, Number(numberOfQuestions) || 5)

    await Interview.findByIdAndUpdate(interviewId, {
      questions: limitedQuestions
    })

    res.status(200).json({ success: true, questions: limitedQuestions })

  } catch (error) {
    const message = error.response?.data?.error || error.message
    res.status(500).json({ message })
  }
}




//  GET INTERVIEW BY ID (questions ke liye)
async function getInterviewById(req, res) {
  try {
    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" })
    }

    res.status(200).json(interview)

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}



// SUBMIT ANSWERS -> AI EVALUATION -> SAVE RESULT
async function sumbitAnswers(req, res) {
  try {
    const { interviewId, answers } = req.body

    const prompt = `
You are a professional technical interviewer.

Evaluate these answers and return JSON:

{
 "results":[{"question":"","answer":"","score":"","overAllFeedback":""}],
 "overAllFeedback":"",
 "improvements":"",
 "finalRating":""
}

Answers:
${JSON.stringify(answers)}
`

    const rawText = await callAiModel(prompt)
    const cleanedText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let evaluation = null

    try {
      evaluation = JSON.parse(cleanedText)
    } catch (error) {
      const firstBracket = cleanedText.indexOf('{')
      const lastBracket = cleanedText.lastIndexOf('}')

      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        try {
          evaluation = JSON.parse(cleanedText.slice(firstBracket, lastBracket + 1))
        } catch {
          evaluation = null
        }
      }
    }

    if (!evaluation || !Array.isArray(evaluation?.results) || evaluation.results.length === 0) {
      evaluation = buildFallbackEvaluation(answers)
    }

    const results = Array.isArray(evaluation?.results) ? evaluation.results : []
    let totalScore = 0

    results.forEach((item) => {
      const score = parseScoreValue(item?.score)
      if (score !== null) {
        totalScore += score
      }
    })

    if (results.length > 0) {
      totalScore = totalScore / results.length
    }

    if (interviewId && interviewId !== 'test') {
      await Interview.findByIdAndUpdate(interviewId, {
        answers,
        evaluation: results,
        score: totalScore,
        overAllFeedback: evaluation?.overAllFeedback || '',
        improvements: evaluation?.improvements || [],
        finalRating: evaluation?.finalRating || '',
        submittedAt: new Date()
      })
    }

    res.status(200).json({ success: true, totalScore, evaluation })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}





//  GET RESULT BY ID
async function getResultById(req, res) {
  try {
    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      return res.status(404).json({success:false, message: "Interview not found" })
    }

    res.status(200).json({
      evaluation: interview.evaluation,
      score: interview.score,
      overAlloverAllFeedback: interview.overAlloverAllFeedback,
      improvements: interview.improvements,
      finalRating: interview.finalRating
    })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}


module.exports = {
  createInterview,
  generateQuestions,
  sumbitAnswers,
  getInterviewById,
  getResultById
}