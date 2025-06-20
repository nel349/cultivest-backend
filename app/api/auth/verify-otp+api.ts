export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, otpCode } = body;

    if (!userID || !otpCode) {
      return new Response(
        JSON.stringify({ error: 'Missing userID or otpCode' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock OTP verification (in production, verify against stored OTP)
    if (otpCode === '123456') {
      const mockAuthToken = `auth_token_${Date.now()}`;
      
      return Response.json({
        success: true,
        message: 'OTP verified successfully3',
        authToken: mockAuthToken,
        user: {
          userID,
          verified: true,
          walletCreated: true,
        },
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP code' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    // Log the actual error to your Expo terminal/debugger console
    console.error('Error in verify-otp+api:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}