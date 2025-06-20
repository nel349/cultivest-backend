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

    // Mock investment positions
    const mockPositions = [
      {
        positionID: 'position_1',
        userID,
        poolID: 'tinyman_usdca_pool',
        investedAmountUSDCa: 5.00,
        currentAPY: 2.5,
        totalYieldEarned: 0.015,
        startDate: '2024-01-15T00:00:00Z',
        status: 'active',
      },
    ];

    return Response.json({
      success: true,
      positions: mockPositions,
      totalInvested: 5.00,
      totalYieldEarned: 0.015,
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