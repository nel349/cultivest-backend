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

    // Mock wallet balance data
    const mockBalance = {
      userID,
      walletAddress: 'ALGO_MOCK_ADDRESS_' + userID.slice(-8),
      balanceUSDCa: 5.00,
      balanceAlgo: 0.1,
      lastUpdated: new Date().toISOString(),
    };

    return Response.json({
      success: true,
      balance: mockBalance,
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