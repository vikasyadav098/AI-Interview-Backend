const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    role: String,
    questions: [Object],
    answers: [Object],
    overAllFeedback: String,
    score: Number,
  },
  { timestamps: true }
)

const interviewModel = mongoose.model('Interview', interviewSchema);

module.exports = interviewModel;