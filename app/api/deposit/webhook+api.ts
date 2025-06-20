export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { depositID, status, transactionHash } = body;

    // Mock webhook processing
    if (status === 'completed') {
      const mockResult = {
        depositID,
        status: 'completed',
        usdcaTransferred: true,
        algorandTxID: `ALGO_TX_${Date.now()}`,
        processedAt: new Date().toISOString(),
      };

      return Response.json({
        success: true,
        message: 'Deposit processed successfully',
        result: mockResult,
      });
    }

    return Response.json({
      success: true,
      message: 'Webhook received',
      status,
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