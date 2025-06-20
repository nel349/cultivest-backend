import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, contentID, answers } = req.body;

    if (!userID || !contentID || !answers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mock quiz grading (correct answers: [1, 1, 1])
    const correctAnswers = [1, 1, 1];
    let score = 0;
    
    answers.forEach((answer: number, index: number) => {
      if (answer === correctAnswers[index]) {
        score++;
      }
    });

    const passed = score >= 2; // Need 2/3 to pass
    const mockResult = {
      resultID: `result_${Date.now()}`,
      userID,
      contentID,
      score,
      totalQuestions: correctAnswers.length,
      passed,
      completedAt: new Date().toISOString(),
    };

    let badgeAwarded = null;
    if (passed && contentID === 'safety_quiz') {
      badgeAwarded = {
        badgeID: 'safe_saver',
        name: 'Safe Saver',
        description: 'Completed the stablecoin safety quiz',
        awardedAt: new Date().toISOString(),
      };
    }

    return res.json({
      success: true,
      result: mockResult,
      badgeAwarded,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 