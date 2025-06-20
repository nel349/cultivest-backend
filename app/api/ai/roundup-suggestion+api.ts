export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, transactionAmount, merchantName } = body;

    if (!userID || !transactionAmount) {
      return new Response(
        JSON.stringify({ error: 'Missing userID or transactionAmount' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock Claude 4 round-up suggestion
    const amount = parseFloat(transactionAmount);
    const roundedAmount = Math.ceil(amount);
    const roundUpAmount = roundedAmount - amount;

    const mockSuggestion = {
      userID,
      originalTransaction: {
        amount,
        merchantName: merchantName || 'Coffee Shop',
      },
      roundUpAmount: parseFloat(roundUpAmount.toFixed(2)),
      suggestedInvestment: {
        pool: 'Tinyman USDCa Pool',
        apy: 2.5,
        estimatedDailyYield: (roundUpAmount * 0.025 / 365).toFixed(6),
      },
      message: `Round up your $${amount.toFixed(2)} purchase to $${roundedAmount.toFixed(2)} and invest the $${roundUpAmount.toFixed(2)} difference!`,
      confidence: 0.85,
      generatedAt: new Date().toISOString(),
    };

    return Response.json({
      success: true,
      suggestion: mockSuggestion,
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