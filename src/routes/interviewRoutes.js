const express= require('express')
const router = express.Router()
const interviewController=require('../controllers/interviewController')

router.post('/create',interviewController.createInterview)

router.post('/generatequestions',interviewController.generateQuestions)

router.post('/submit',interviewController.sumbitAnswers)
router.post('/evaluate',interviewController.sumbitAnswers)
router.post('/:id/evaluate',interviewController.sumbitAnswers)

router.get('/result/:id',interviewController.getResultById)

router.get('/:id',interviewController.getInterviewById)



module.exports=router