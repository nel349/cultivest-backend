export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, amount, provider, bankDetails } = body;

    if (!userID || !amount || !provider) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock withdrawal initiation
    const mockWithdrawal = {
      withdrawalID: `withdrawal_${Date.now()}`,
      userID,
      amount: parseFloat(amount),
      provider, // 'moonpay' or 'flutterwave'
      fee: parseFloat(amount) * 0.01, // 1% fee
      netAmount: parseFloat(amount) * 0.99,
      status: 'processing',
      algorandTxID: `ALGO_WITHDRAW_${Date.now()}`,
      estimatedArrival: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      createdAt: new Date().toISOString(),
    };

    return Response.json({
      success: true,
      message: 'Withdrawal initiated successfully',
      withdrawal: mockWithdrawal,
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