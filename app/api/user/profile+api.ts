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

    // Mock user profile data
    const mockProfile = {
      userID,
      name: 'Sarah Johnson',
      phoneNumber: '+1234567890',
      country: 'US',
      email: 'sarah.johnson@email.com',
      kycStatus: 'approved',
      currentBalanceUSDCa: 5.00,
      dailyYieldAccumulated: 0.003,
      moneyTreeLeaves: 5,
      totalWorkouts: 124,
      daysActive: 89,
      achievements: 12,
      joinedAt: '2024-01-15T00:00:00Z',
    };

    return Response.json({
      success: true,
      profile: mockProfile,
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