export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userID = url.searchParams.get('userID');

    if (!userID) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock dashboard data
    const mockDashboard = {
      userID,
      balance: 5.00,
      dailyYield: 0.003,
      moneyTree: {
        leaves: 5,
        growthStage: 'growing',
        nextMilestone: 10.00,
      },
      badges: [
        {
          badgeID: 'first_investor',
          name: 'First Investor!',
          description: 'Made your first investment',
          awardedAt: '2024-01-15T00:00:00Z',
        },
      ],
      stats: {
        totalInvested: 5.00,
        totalYieldEarned: 0.015,
        daysActive: 5,
        investmentStreak: 1,
      },
      weeklyProgress: [
        { day: 'Mon', value: 80 },
        { day: 'Tue', value: 65 },
        { day: 'Wed', value: 90 },
        { day: 'Thu', value: 75 },
        { day: 'Fri', value: 85 },
        { day: 'Sat', value: 95 },
        { day: 'Sun', value: 70 },
      ],
    };

    return Response.json({
      success: true,
      dashboard: mockDashboard,
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