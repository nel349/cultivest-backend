import express from 'express';

const router = express.Router();

// Mock smart contract deployment and call
router.post('/hello-world', async (req, res) => {
  try {
    const { name, userAddress } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name parameter is required' 
      });
    }

    if (!userAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'User address is required for deployment' 
      });
    }

    // Simulate smart contract deployment and call
    const mockResult = {
      message: `Hello, ${name}!`,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      appId: Math.floor(Math.random() * 1000000).toString(),
      appAddress: `APP_${Math.random().toString(36).substr(2, 20)}`,
    };

    return res.json({
      success: true,
      data: mockResult
    });

  } catch (error) {
    console.error('Mock smart contract error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Mock get contract information
router.get('/hello-world/:appId', async (req, res) => {
  try {
    const { appId } = req.params;

    const mockInfo = {
      appId: parseInt(appId),
      createdAtRound: Math.floor(Math.random() * 1000000),
      params: {
        creator: 'CREATOR_ADDRESS_HERE',
        approval: 'APPROVAL_PROGRAM_HASH',
        clear: 'CLEAR_PROGRAM_HASH',
      }
    };

    return res.json({
      success: true,
      data: mockInfo
    });

  } catch (error) {
    console.error('Get mock contract info error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get contract info'
    });
  }
});

// Mock call existing contract
router.post('/hello-world/:appId/call', async (req, res) => {
  try {
    const { appId } = req.params;
    const { name, userAddress } = req.body;

    if (!name || !userAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and userAddress are required' 
      });
    }

    // Simulate contract call
    const mockResult = {
      message: `Hello, ${name}! (from App ID: ${appId})`,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      appId: appId,
    };

    return res.json({
      success: true,
      data: mockResult
    });

  } catch (error) {
    console.error('Mock contract call error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Contract call failed'
    });
  }
});

export default router; 