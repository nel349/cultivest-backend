export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, contentID, answers } = body;

    if (!userID || !contentID || !answers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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

    return Response.json({
      success: true,
      result: mockResult,
      badgeAwarded,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}