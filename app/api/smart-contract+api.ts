import express from 'express';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { HelloWorldFactory } from '../../contracts/cultivest_contract/projects/cultivest_contract-contracts/smart_contracts/artifacts/hello_world/HelloWorldClient.js';
import { OnSchemaBreak, OnUpdate } from '@algorandfoundation/algokit-utils/types/app';
import { getUserWallet, decryptPrivateKey } from '../../utils/wallet';
import algosdk from 'algosdk';

const router = express.Router();

// Configure Algorand client
const getAlgorandClient = () => {
  // For localnet - AlgoKit default configuration
  const algodConfig = {
    server: 'http://localhost',
    port: 4001,
    token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
  
  const indexerConfig = {
    server: 'http://localhost',
    port: 8980,
    token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };

  return AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  });
};

// Get user's wallet and create signing account
const getUserSigningAccount = async (userId: string) => {
  try {
    // Get user's wallet from database
    const wallet = await getUserWallet(userId);
    if (!wallet) {
      throw new Error('User wallet not found');
    }

    // Get encrypted private key (try new field first, fallback to legacy)
    const encryptedPrivateKey = wallet.encryptedAlgorandPrivateKey;
    if (!encryptedPrivateKey) {
      throw new Error('No encrypted Algorand private key found for user');
    }

    // Decrypt the private key
    const mnemonic = decryptPrivateKey(encryptedPrivateKey);
    
    // Convert mnemonic to account
    const account = algosdk.mnemonicToSecretKey(mnemonic);
    
    // Use the address from the account object (derived from private key)
    // This ensures consistency and proper formatting
    const address = account.addr;
    
    console.log(`🔐 Derived address from account: ${address}`);
    console.log(`📊 Database address: ${wallet.algorandAddress}`);
    console.log(`✅ Using derived address for transaction signing`);
    
    return {
      account,
      address, // Use derived address instead of database address
      wallet
    };
  } catch (error) {
    console.error('Error getting user signing account:', error);
    throw error;
  }
};

// Deploy and call HelloWorld contract
router.post('/hello-world', async (req, res) => {
  try {
    const { name, userId } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name parameter is required' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required for wallet access' 
      });
    }

    // Get user's signing account from encrypted wallet
    const { account, address } = await getUserSigningAccount(userId);
    
    const algorand = getAlgorandClient();
    
    // Set the signer using the user's account
    algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
    
    const factory = new HelloWorldFactory({
      defaultSender: address,
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
        appId: deployResult.result.appId.toString(), // Convert BigInt to string
        appAddress: deployResult.result.appAddress.toString(), // Convert Address to string
        userAddress: address.toString(), // Convert Address to string
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
    const { name, userId } = req.body;

    if (!name || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and userId are required' 
      });
    }

    // Get user's signing account from encrypted wallet
    const { account, address } = await getUserSigningAccount(userId);

    const algorand = getAlgorandClient();
    
    // Set the signer using the user's account
    algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
    
    const factory = new HelloWorldFactory({
      defaultSender: address,
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
        appId: appId.toString(), // Ensure appId is string
        userAddress: address.toString(), // Convert Address to string
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