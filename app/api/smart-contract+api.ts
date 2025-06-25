import express from 'express';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { HelloWorldFactory } from '../../contracts/cultivest_contract/projects/cultivest_contract-contracts/smart_contracts/artifacts/hello_world/HelloWorldClient';
import { OnSchemaBreak, OnUpdate } from '@algorandfoundation/algokit-utils/types/app';

const router = express.Router();

// Configure Algorand client
const getAlgorandClient = () => {
  // For testnet - you can make this configurable via environment variables
  const algodConfig = {
    server: 'https://testnet-api.algonode.cloud',
    port: 443,
    token: '',
  };
  
  const indexerConfig = {
    server: 'https://testnet-idx.algonode.cloud',
    port: 443,
    token: '',
  };

  return AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  });
};

// Deploy and call HelloWorld contract
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

    const algorand = getAlgorandClient();
    
    // For demo purposes, we'll use the provided address as the sender
    // In production, you'd have proper wallet integration
    const factory = new HelloWorldFactory({
      defaultSender: userAddress,
      algorand,
    });

    // Deploy the contract
    const deployResult = await factory.deploy({
      onSchemaBreak: OnSchemaBreak.AppendApp,
      onUpdate: OnUpdate.AppendApp,
    });

    const { appClient } = deployResult;

    // Call the hello method
    const response = await appClient.send.hello({ 
      args: { name } 
    });

    return res.json({
      success: true,
      data: {
        message: response.return,
        transactionId: response.transaction.txID,
        appId: deployResult.result.appId,
        appAddress: deployResult.result.appAddress,
      }
    });

  } catch (error) {
    console.error('Smart contract error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get contract information
router.get('/hello-world/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const algorand = getAlgorandClient();

    const appInfo = await algorand.client.algod.getApplicationByID(parseInt(appId)).do();

    return res.json({
      success: true,
      data: {
        appId: appInfo.id,
        createdAtRound: (appInfo as any)['created-at-round'],
        params: appInfo.params,
      }
    });

  } catch (error) {
    console.error('Get contract info error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get contract info'
    });
  }
});

// Call existing contract
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

    const algorand = getAlgorandClient();
    
    const factory = new HelloWorldFactory({
      defaultSender: userAddress,
      algorand,
    });

    // Get existing app client
    const appClient = factory.getAppClientById({
      appId: BigInt(appId)
    });

    // Call the hello method
    const response = await appClient.send.hello({ 
      args: { name } 
    });

    return res.json({
      success: true,
      data: {
        message: response.return,
        transactionId: response.transaction.txID,
        appId: appId,
      }
    });

  } catch (error) {
    console.error('Contract call error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Contract call failed'
    });
  }
});

export default router; 