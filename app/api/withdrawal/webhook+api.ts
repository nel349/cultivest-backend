export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { withdrawalID, status, fiatTxID } = body;

    // Mock withdrawal webhook processing
    const mockResult = {
      withdrawalID,
      status,
      fiatTxID,
      processedAt: new Date().toISOString(),
      emailSent: status === 'completed',
    };

    return Response.json({
      success: true,
      message: 'Withdrawal webhook processed',
      result: mockResult,
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