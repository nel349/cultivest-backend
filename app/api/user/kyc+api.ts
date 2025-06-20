export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userID, kycData } = body;

    if (!userID) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mock MoonPay KYC-light processing
    const mockKycResult = {
      status: 'approved',
      kycLevel: 'light',
      monthlyLimit: 1000,
      verificationTime: new Date().toISOString(),
    };

    return Response.json({
      success: true,
      message: 'KYC verification completed',
      kyc: mockKycResult,
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