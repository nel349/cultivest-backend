import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // MOCK ENDPOINT - Not connected to real authentication
    // TODO: Implement real Supabase authentication flow
    return res.status(501).json({
      success: false,
      error: 'Authentication endpoint not implemented',
      message: 'This is a mock endpoint. Use real authentication service.',
      implementation_needed: 'Integrate with Supabase Auth'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;