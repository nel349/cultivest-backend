export async function GET(request: Request) {
  try {
    // Mock educational content
    const mockContent = [
      {
        contentID: 'usdca_intro',
        type: 'video',
        title: 'Understanding USDCa and GENIUS Act Safety',
        url: 'https://example.com/videos/usdca-intro.mp4',
        duration: 30,
        description: 'Learn about USDCa stablecoin and how the GENIUS Act ensures transparency',
      },
      {
        contentID: 'safety_quiz',
        type: 'quiz',
        title: 'Stablecoin Safety Quiz',
        quizQuestions: [
          {
            question: 'What does USDCa stand for?',
            options: ['USD Coin Algorithm', 'USD Coin Algorand', 'Universal Stable Digital Currency'],
            correctAnswer: 1,
          },
          {
            question: 'What is the typical APY for USDCa yields?',
            options: ['1-2%', '2-3%', '5-10%'],
            correctAnswer: 1,
          },
          {
            question: 'What does the GENIUS Act ensure?',
            options: ['Higher yields', 'Stablecoin transparency', 'Lower fees'],
            correctAnswer: 1,
          },
        ],
        unlocksBadgeID: 'safe_saver',
      },
    ];

    return Response.json({
      success: true,
      content: mockContent,
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