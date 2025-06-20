export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumber, name, country } = body;

    // Validate required fields
    if (!phoneNumber || !name || !country) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: phoneNumber, name, country' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock user creation and OTP sending
    const mockUser = {
      userID: `user_${Date.now()}`,
      phoneNumber,
      name,
      country,
      kycStatus: 'pending',
      otpSent: true,
      otpCode: '123456', // In production, this would be generated and sent via SMS
    };

    return Response.json({
      success: true,
      message: 'OTP sent successfully',
      userID: mockUser.userID,
      otpSent: true,
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