import express from 'express';
import { getUserWallet, decryptPrivateKey } from '../../../utils/wallet';

const router = express.Router();

// GET /api/v1/wallet/mnemonic - Get 12-word mnemonic phrase for wallet
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing userId parameter' 
      });
    }

    console.log(`🔑 Retrieving mnemonic for user: ${userId}`);

    // Get user wallet
    const wallet = await getUserWallet(userId as string, false);
    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet not found for user' 
      });
    }

    // Decrypt the private key (which is actually the mnemonic)
    if (!wallet.encryptedAlgorandPrivateKey) {
      return res.status(404).json({ 
        success: false,
        error: 'Encrypted private key not found for wallet' 
      });
    }
    const mnemonic = decryptPrivateKey(wallet.encryptedAlgorandPrivateKey);

    console.log(`✅ Mnemonic retrieved successfully for user ${userId}`);

    return res.json({
      success: true,
      userID: userId,
      walletAddress: wallet.algorandAddress,
      mnemonic: mnemonic,
      warning: 'Keep this mnemonic phrase secure and private. Anyone with this phrase can access your wallet.',
      note: 'This is your 12-word recovery phrase for importing into Algorand wallets like Pera Wallet or MyAlgo.'
    });

  } catch (error) {
    console.error('Mnemonic retrieval error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve mnemonic phrase' 
    });
  }
});

export default router; 