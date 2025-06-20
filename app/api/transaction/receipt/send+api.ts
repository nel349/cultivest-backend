export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, transactionID, email, transactionType } = body;

    if (!userID || !transactionID || !email || !transactionType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock email receipt sending
    const mockReceipt = {
      receiptID: `receipt_${Date.now()}`,
      userID,
      transactionID,
      email,
      transactionType, // 'deposit', 'investment', 'withdrawal'
      subject: `Cultivest Transaction Receipt - ${transactionType.toUpperCase()}`,
      sentAt: new Date().toISOString(),
      delivered: true,
    };

    return Response.json({
      success: true,
      message: 'Transaction receipt sent successfully',
      receipt: mockReceipt,
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