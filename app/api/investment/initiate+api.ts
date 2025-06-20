export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, amount } = body;

    if (!userID || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing userID or amount' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock investment initiation
    const mockInvestment = {
      positionID: `position_${Date.now()}`,
      userID,
      poolID: 'tinyman_usdca_pool',
      investedAmountUSDCa: parseFloat(amount),
      currentAPY: 2.5,
      startDate: new Date().toISOString(),
      algorandTxID: `ALGO_INVEST_${Date.now()}`,
      status: 'active',
    };

    return Response.json({
      success: true,
      message: 'Investment initiated successfully',
      investment: mockInvestment,
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