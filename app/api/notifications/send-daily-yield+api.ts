export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, yieldAmount } = body;

    if (!userID || yieldAmount === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing userID or yieldAmount' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock push notification sending
    const mockNotification = {
      notificationID: `notif_${Date.now()}`,
      userID,
      type: 'daily_yield',
      title: 'Daily Yield Earned! 🌱',
      body: `You earned $${parseFloat(yieldAmount).toFixed(3)} today from your USDCa investment!`,
      data: {
        yieldAmount: parseFloat(yieldAmount),
        totalBalance: 5.00 + parseFloat(yieldAmount),
      },
      sentAt: new Date().toISOString(),
      delivered: true,
    };

    return Response.json({
      success: true,
      message: 'Daily yield notification sent',
      notification: mockNotification,
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