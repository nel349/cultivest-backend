import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { CultivestPositionNftFactory } from '../contracts/cultivest_contract/projects/cultivest_contract-contracts/smart_contracts/artifacts/position-nft/CultivestPositionNFTClient';
import { CultivestPortfolioNftFactory } from '../contracts/cultivest_contract/projects/cultivest_contract-contracts/smart_contracts/artifacts/portfolio-nft/CultivestPortfolioNFTClient';
import { getUserWallet, decryptPrivateKey } from '../utils/wallet';
import algosdk from 'algosdk';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';

// NFT contract service for managing Position and Portfolio NFTs
export class NFTContractService {
  private algorand: AlgorandClient;
  private readonly POSITION_NFT_APP_ID: string;
  private readonly PORTFOLIO_NFT_APP_ID: string;

  constructor() {
    this.algorand = this.getAlgorandClient();
    
    // Get app IDs from environment variables or use latest deployed ones
    this.POSITION_NFT_APP_ID = process.env.POSITION_NFT_APP_ID || '1230';
    this.PORTFOLIO_NFT_APP_ID = process.env.PORTFOLIO_NFT_APP_ID || '1228';
    
    if (!this.POSITION_NFT_APP_ID) {
      throw new Error('POSITION_NFT_APP_ID environment variable is required');
    }
    if (!this.PORTFOLIO_NFT_APP_ID) {
      throw new Error('PORTFOLIO_NFT_APP_ID environment variable is required');
    }
    
    console.log('NFT Contract Service initialized');
    console.log('Position NFT App ID:', this.POSITION_NFT_APP_ID);
    console.log('Portfolio NFT App ID:', this.PORTFOLIO_NFT_APP_ID);
  }

  // Configure Algorand client for testnet/mainnet
  private getAlgorandClient(): AlgorandClient {
    const algodUrl = process.env.ALGORAND_ALGOD_URL || 'https://testnet-api.algonode.cloud';
    const algodToken = process.env.ALGORAND_ALGOD_TOKEN || '';
    const network = process.env.ALGORAND_NETWORK || 'testnet';
    
    // Parse URL to get server and port
    const url = new URL(algodUrl);
    const algodConfig = {
      server: algodUrl,
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
      token: algodToken,
    };
    
    // Use Algorand indexer endpoints (AlgoNode provides both)
    const indexerUrl = algodUrl.replace('algod', 'indexer');
    const indexerUrlObj = new URL(indexerUrl);
    const indexerConfig = {
      server: indexerUrl,
      port: indexerUrlObj.port ? parseInt(indexerUrlObj.port) : (indexerUrlObj.protocol === 'https:' ? 443 : 80),
      token: algodToken,
    };

    console.log(`🌐 NFT Service connecting to Algorand ${network}:`, { algodUrl, indexerUrl });

    return AlgorandClient.fromConfig({
      algodConfig,
      indexerConfig,
    });
  }

  /**
   * Get the authorized minter account for contract operations
   * This should be the deployer account that was set as authorizedMinter during contract creation
   * 
   * In production, this would use secure key management (HSM, AWS KMS, etc.)
   * For development, we use environment variables
   */
  private getAuthorizedMinterAccount(): algosdk.Account {
    const minterMnemonic = process.env.AUTHORIZED_MINTER_MNEMONIC || process.env.DEPLOYER_MNEMONIC;
    
    if (!minterMnemonic) {
      throw new Error('AUTHORIZED_MINTER_MNEMONIC or DEPLOYER_MNEMONIC environment variable is required');
    }

    try {
      return algosdk.mnemonicToSecretKey(minterMnemonic);
    } catch (error) {
      throw new Error('Invalid minter mnemonic: ' + error);
    }
  }

  /**
   * Ensure minter account has sufficient balance for NFT operations
   * Funds the account if balance is too low
   */
  private async ensureMinterHasSufficientBalance(minterAccount: algosdk.Account): Promise<void> {
    try {
      const minterAddress = minterAccount.addr;
      
      // Check current balance using legacy algod client for compatibility
      const algodUrl = process.env.ALGORAND_ALGOD_URL || 'https://testnet-api.algonode.cloud';
      const algodToken = process.env.ALGORAND_ALGOD_TOKEN || '';
      const algodClient = new algosdk.Algodv2(algodToken, algodUrl, '');
      
      const accountInfo = await algodClient.accountInformation(minterAddress).do();
      const currentBalance = Number(accountInfo.amount); // in microAlgos
      const requiredBalance = 2_000_000; // 2 ALGO in microAlgos
      
      console.log(`💰 Minter account ${minterAddress} balance: ${currentBalance} microAlgos (${currentBalance / 1_000_000} ALGO)`);
      
      if (currentBalance < requiredBalance) {
        console.log(`⚠️ Minter account balance too low, need ${requiredBalance} microAlgos, funding...`);
        
        // Use testnet dispenser to fund the minter account 
        const dispenserMnemonic = process.env.TESTNET_DISPENSER_MNEMONIC || process.env.DEPLOYER_MNEMONIC;
        
        if (dispenserMnemonic) {
          const dispenserAccount = algosdk.mnemonicToSecretKey(dispenserMnemonic);
          const fundAmount = 5_000_000; // 5 ALGO
          
          console.log(`💸 Funding minter account with ${fundAmount} microAlgos (${fundAmount / 1_000_000} ALGO)`);
          
          const params = await algodClient.getTransactionParams().do();
          const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: dispenserAccount.addr,
            receiver: minterAddress,
            amount: fundAmount,
            suggestedParams: params,
          });
          
          const signedTxn = txn.signTxn(dispenserAccount.sk);
          const txResponse = await algodClient.sendRawTransaction(signedTxn).do();
          
          // Wait for confirmation
          await algosdk.waitForConfirmation(algodClient, txResponse.txid, 4);
          
          console.log(`✅ Minter account funded successfully: ${txResponse.txid}`);
        } else {
          console.error('❌ No dispenser available to fund minter account');
          throw new Error('Minter account has insufficient balance and no dispenser available');
        }
      } else {
        console.log(`✅ Minter account has sufficient balance`);
      }
    } catch (error) {
      console.error('Error checking/funding minter account:', error);
      // Don't throw - continue with transaction and let it fail if needed
      console.log('⚠️ Continuing with existing minter balance...');
    }
  }

  // Get user's signing account (same as existing pattern)
  private async getUserSigningAccount(userId: string) {
    try {
      const wallet = await getUserWallet(userId);
      if (!wallet) {
        throw new Error('User wallet not found');
      }

      const encryptedPrivateKey = wallet.encryptedAlgorandPrivateKey;
      if (!encryptedPrivateKey) {
        throw new Error('No encrypted Algorand private key found for user');
      }

      const mnemonic = decryptPrivateKey(encryptedPrivateKey);
      const account = algosdk.mnemonicToSecretKey(mnemonic);
      const address = account.addr;
      
      return { account, address, wallet };
    } catch (error) {
      console.error('Error getting user signing account:', error);
      throw error;
    }
  }

  // =======================
  // POSITION NFT METHODS
  // =======================

  /**
   * Mint a new position token for an investment
   * 
   * ROLES:
   * - Signer: Authorized minter (backend service using deployer credentials)
   * - Owner/Recipient: The user who will receive and own the NFT token
   * 
   * @param userId - Used for logging/tracking purposes
   * @param params.owner - Algorand address of the user who will own the NFT (recipient)
   * @param params.assetType - 1=Bitcoin, 2=Algorand, 3=USDC
   * @param params.holdings - Amount held in smallest units
   * @param params.purchaseValueUsd - Purchase value in USD cents
   */
  async mintPositionToken(
    params: {
      owner: string; // Recipient address - who will own the NFT
      assetType: number; // 1=Bitcoin, 2=Algorand, 3=USDC
      holdings: bigint;
      purchaseValueUsd: bigint;
    }
  ) {
    try {
      // Use authorized minter account to sign the transaction
      const minterAccount = this.getAuthorizedMinterAccount();
      
      // Ensure minter has sufficient balance for NFT operations
      await this.ensureMinterHasSufficientBalance(minterAccount);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(minterAccount));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: minterAccount.addr,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.mintPosition({
        args: {
          owner: params.owner, // This is the recipient/owner of the NFT
          assetType: BigInt(params.assetType),
          holdings: params.holdings,
          purchaseValueUsd: params.purchaseValueUsd
        }
      });

      console.log(`Position token minted: Token ID ${response.return} for owner ${params.owner} by minter ${minterAccount.addr}`);

      return {
        tokenId: response.return?.toString(),
        transactionId: response.transaction.txID,
        appId: this.POSITION_NFT_APP_ID
      };
    } catch (error) {
      console.error('Position token minting error:', error);
      throw error;
    }
  }

  /**
   * Update position token holdings
   * 
   * ROLES:
   * - Signer: Authorized minter (backend service using deployer credentials)
   * - Token: Existing position token being updated
   * 
   * @param userId - Used for logging/tracking purposes  
   * @param params.positionTokenId - The token ID to update
   * @param params.newHoldings - New holdings amount
   */
  async updatePositionToken(
    params: {
      positionTokenId: bigint;
      newHoldings: bigint;
    }
  ) {
    try {
      // Use authorized minter account to sign the transaction
      const minterAccount = this.getAuthorizedMinterAccount();
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(minterAccount));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: minterAccount.addr,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.updatePosition({
        args: {
          positionTokenId: params.positionTokenId,
          newHoldings: params.newHoldings
        }
      });

      console.log(`Position token updated: Token ID ${params.positionTokenId} by minter ${minterAccount.addr}`);

      return {
        transactionId: response.transaction.txID,
        appId: this.POSITION_NFT_APP_ID
      };
    } catch (error) {
      console.error('Position token update error:', error);
      throw error;
    }
  }

  /**
   * Get Position NFT contract statistics
   */
  async getPositionNFTStats(userId: string) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.getContractStats({
        args: {}
      });

      return {
        totalTokensMinted: response.return![0].toString(),
        currentSupply: response.return![1].toString(),
        maxSupply: response.return![2].toString(),
        contractVersion: response.return![3].toString()
      };
    } catch (error) {
      console.error('Position NFT stats error:', error);
      throw error;
    }
  }

  /**
   * Check if a position token exists
   */
  async positionExists(userId: string, tokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.positionExists({
        args: { tokenId }
      });

      return {
        exists: response.return || false,
        tokenId: tokenId.toString(),
        appId: this.POSITION_NFT_APP_ID
      };
    } catch (error) {
      console.error('Position exists check error:', error);
      throw error;
    }
  }

  /**
   * Get position token owner
   */
  async getPositionOwner(userId: string, tokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.getPositionOwner({
        args: { tokenId }
      });

      // Convert Base64 encoded bytes to Algorand address
      const ownerBytes = response.return;
      let ownerAddress = '';
      let ownerBase64 = '';
      
      if (ownerBytes) {
        try {
          // Convert to Base64 for consistent format
          ownerBase64 = Buffer.from(ownerBytes as any).toString('base64');
          // Convert to Algorand address
          ownerAddress = algosdk.encodeAddress(new Uint8Array(ownerBytes as any));
        } catch (error) {
          console.error('Error converting owner bytes:', error);
        }
      }

      return {
        owner: ownerAddress,
        ownerBase64: ownerBase64,
        tokenId: tokenId.toString(),
        appId: this.POSITION_NFT_APP_ID
      };
    } catch (error) {
      console.error('Get position owner error:', error);
      throw error;
    }
  }

  /**
   * Get position token asset type
   */
  async getPositionAssetType(userId: string, tokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.getPositionAssetType({
        args: { tokenId }
      });

      const assetType = response.return || BigInt(0);
      const assetTypeNames = {
        1: 'Bitcoin',
        2: 'Algorand', 
        3: 'USDC',
        4: 'Solana'
      };

      // Debug logging for asset type lookup
      const assetTypeNumber = Number(assetType);
      console.log(`🔍 Asset Type Debug for token ${tokenId}:`);
      console.log(`- Raw return: ${response.return}`);
      console.log(`- AssetType BigInt: ${assetType}`);
      console.log(`- AssetType Number: ${assetTypeNumber}`);
      console.log(`- Available keys: ${Object.keys(assetTypeNames)}`);

      // More robust asset type name lookup
      let assetTypeName = 'Unknown';
      if (assetTypeNumber === 1) assetTypeName = 'Bitcoin';
      else if (assetTypeNumber === 2) assetTypeName = 'Algorand';
      else if (assetTypeNumber === 3) assetTypeName = 'USDC';
      else if (assetTypeNumber === 4) assetTypeName = 'Solana';

      console.log(`- Final asset type name: ${assetTypeName}`);

      return {
        assetType: assetType.toString(),
        assetTypeName: assetTypeName,
        tokenId: tokenId.toString(),
        appId: this.POSITION_NFT_APP_ID
      };
    } catch (error) {
      console.error('Get position asset type error:', error);
      throw error;
    }
  }

  /**
   * Get position token holdings
   */
  async getPositionHoldings(userId: string, tokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.getPositionHoldings({
        args: { tokenId }
      });

      return {
        holdings: (response.return || BigInt(0)).toString(),
        tokenId: tokenId.toString(),
        appId: this.POSITION_NFT_APP_ID
      };
    } catch (error) {
      console.error('Get position holdings error:', error);
      throw error;
    }
  }

  /**
   * Get position token purchase value
   */
  async getPositionPurchaseValue(userId: string, tokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPositionNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const response = await appClient.send.getPositionPurchaseValue({
        args: { tokenId }
      });

      return {
        purchaseValue: (response.return || BigInt(0)).toString(),
        tokenId: tokenId.toString(),
        appId: this.POSITION_NFT_APP_ID
      };
    } catch (error) {
      console.error('Get position purchase value error:', error);
      throw error;
    }
  }

  // =======================
  // PORTFOLIO NFT METHODS
  // =======================

  /**
   * Mint a new portfolio token
   * 
   * ROLES:
   * - Signer: Authorized minter (backend service using deployer credentials)
   * - Owner/Recipient: The user who will receive and own the portfolio NFT
   * 
   * @param userId - Used for logging/tracking purposes
   * @param params.owner - Algorand address of the user who will own the portfolio NFT (recipient)
   * @param params.level - Portfolio level (1-5)
   * @param params.metadataCid - IPFS CID for portfolio metadata
   */
  async mintPortfolioToken(
    params: {
      owner: string; // Recipient address - who will own the portfolio NFT
      level: number;
      metadataCid: string; // IPFS CID for portfolio metadata
    }
  ) {
    try {
      // Use authorized minter account to sign the transaction
      const minterAccount = this.getAuthorizedMinterAccount();
      
      // Ensure minter has sufficient balance for NFT operations
      await this.ensureMinterHasSufficientBalance(minterAccount);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(minterAccount));
      
      const factory = new CultivestPortfolioNftFactory({
        defaultSender: minterAccount.addr,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.PORTFOLIO_NFT_APP_ID)
      });

      const response = await appClient.send.mintPortfolio({
        args: {
          owner: params.owner, // This is the recipient/owner of the portfolio NFT
          level: BigInt(params.level),
          metadataCid: params.metadataCid
        }
      });

      console.log(`Portfolio token minted: Token ID ${response.return} for owner ${params.owner} by minter ${minterAccount.addr}`);

      return {
        tokenId: response.return?.toString(),
        transactionId: response.transaction.txID(),
        appId: this.PORTFOLIO_NFT_APP_ID
      };
    } catch (error) {
      console.error('Portfolio token minting error:', error);
      throw error;
    }
  }

  /**
   * Add position token to portfolio
   */
  async addPositionToPortfolio(
    params: {
      portfolioTokenId: bigint;
      positionTokenId: bigint;
      owner: string;
    }
  ) {
    try {
      // Use authorized minter account to sign the transaction (like mintPositionToken)
      const minterAccount = this.getAuthorizedMinterAccount();
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(minterAccount));
      
      const factory = new CultivestPortfolioNftFactory({
        defaultSender: minterAccount.addr,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.PORTFOLIO_NFT_APP_ID)
      });

      // Debug: Check contract state before attempting to add position
      console.log(`🔍 Contract Debug - Checking portfolio contract state:`);
      const contractStats = await appClient.send.getContractStats({ args: {} });
      console.log(`- Current nextTokenId: ${contractStats.return![0]}`);
      console.log(`- Current totalSupply: ${contractStats.return![1]}`);
      console.log(`- Portfolio Token ID to use: ${params.portfolioTokenId}`);
      console.log(`- Position Token ID to add: ${params.positionTokenId}`);
      console.log(`- Contract expects: portfolioTokenId < nextTokenId (${params.portfolioTokenId} < ${contractStats.return![0]})`);
      
      // Check if portfolio exists
      const portfolioExists = await appClient.send.portfolioExists({ 
        args: { portfolioTokenId: params.portfolioTokenId } 
      });
      console.log(`- Portfolio ${params.portfolioTokenId} exists: ${portfolioExists.return}`);

      const response = await appClient.send.addPositionToPortfolio({
        args: {
          portfolioTokenId: params.portfolioTokenId,
          positionTokenId: params.positionTokenId,
          owner: params.owner
        }
      });

      console.log(`Position ${params.positionTokenId} added to portfolio ${params.portfolioTokenId} for owner ${params.owner} by minter ${minterAccount.addr}`);

      return {
        transactionId: response.transaction.txID,
        appId: this.PORTFOLIO_NFT_APP_ID
      };
    } catch (error) {
      console.error('Add position to portfolio error:', error);
      throw error;
    }
  }

  /**
   * Get Portfolio NFT contract statistics
   */
  async getPortfolioNFTStats(userId: string) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPortfolioNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.PORTFOLIO_NFT_APP_ID)
      });

      const response = await appClient.send.getContractStats({
        args: {}
      });

      return {
        totalTokensMinted: response.return![0].toString(),
        currentSupply: response.return![1].toString(),
        maxSupply: response.return![2].toString(),
        contractVersion: response.return![3].toString(),
        positionNFTAppId: response.return![4].toString()
      };
    } catch (error) {
      console.error('Portfolio NFT stats error:', error);
      throw error;
    }
  }

  /**
   * Get portfolio position count
   */
  async getPortfolioPositionCount(userId: string, portfolioTokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPortfolioNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.PORTFOLIO_NFT_APP_ID)
      });

      const response = await appClient.send.getPortfolioPositionCount({
        args: { portfolioTokenId }
      });

      return {
        positionCount: response.return?.toString() || '0'
      };
    } catch (error) {
      console.error('Get portfolio position count error:', error);
      throw error;
    }
  }

  /**
   * Get which portfolio a position belongs to
   */
  async getPositionPortfolio(userId: string, positionTokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      const factory = new CultivestPortfolioNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.PORTFOLIO_NFT_APP_ID)
      });

      const response = await appClient.send.getPositionPortfolio({
        args: { positionTokenId }
      });

      return {
        portfolioTokenId: response.return?.toString() || '0'
      };
    } catch (error) {
      console.error('Get position portfolio error:', error);
      throw error;
    }
  }

  /**
   * Get all positions that belong to a specific portfolio
   * Uses the new efficient contract method that stores position IDs directly
   */
  async getPortfolioPositions(userId: string, portfolioTokenId: bigint) {
    try {
      const { account, address } = await this.getUserSigningAccount(userId);
      
      this.algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(account));
      
      // Get portfolio factory to fetch position IDs
      const portfolioFactory = new CultivestPortfolioNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const portfolioAppClient = portfolioFactory.getAppClientById({
        appId: BigInt(this.PORTFOLIO_NFT_APP_ID)
      });

      // Get the packed position IDs from the contract (MUCH MORE EFFICIENT!)
      const positionIdsResponse = await portfolioAppClient.send.getPortfolioPositionIds({
        args: { portfolioTokenId }
      });

      const positionIdsBytes = positionIdsResponse.return;
      
      if (!positionIdsBytes || positionIdsBytes.length === 0) {
        // Portfolio has no positions
        return {
          portfolioTokenId: portfolioTokenId.toString(),
          positionCount: 0,
          positions: [],
          appId: this.PORTFOLIO_NFT_APP_ID
        };
      }

      // Unpack the position IDs (each uint64 is 8 bytes)
      const positionIds: bigint[] = [];
      const positionIdsBuffer = Buffer.from(positionIdsBytes as any);
      
      for (let i = 0; i < positionIdsBuffer.length; i += 8) {
        const positionIdBytes = positionIdsBuffer.subarray(i, i + 8);
        const positionId = positionIdBytes.readBigUInt64BE(0);
        positionIds.push(positionId);
      }

      // Get position factory to fetch position details
      const positionFactory = new CultivestPositionNftFactory({
        defaultSender: address,
        algorand: this.algorand,
      });

      const positionAppClient = positionFactory.getAppClientById({
        appId: BigInt(this.POSITION_NFT_APP_ID)
      });

      const positions = [];
      
      // Now fetch details for each position ID (much fewer calls!)
      for (const tokenId of positionIds) {
        try {
          // Get all position details in parallel
          const [owner, assetType, holdings, purchaseValue] = await Promise.all([
            positionAppClient.send.getPositionOwner({ args: { tokenId } }),
            positionAppClient.send.getPositionAssetType({ args: { tokenId } }),
            positionAppClient.send.getPositionHoldings({ args: { tokenId } }),
            positionAppClient.send.getPositionPurchaseValue({ args: { tokenId } })
          ]);

          // Convert owner bytes to address and Base64
          let ownerAddress = '';
          let ownerBase64 = '';
          
          if (owner.return) {
            try {
              ownerBase64 = Buffer.from(owner.return as any).toString('base64');
              ownerAddress = algosdk.encodeAddress(new Uint8Array(owner.return as any));
            } catch (error) {
              console.error('Error converting owner bytes for position', tokenId, error);
            }
          }

          const assetTypeNum = Number(assetType.return || BigInt(0));

          // Robust asset type name lookup (same as getPositionAssetType method)
          let assetTypeName = 'Unknown';
          if (assetTypeNum === 1) assetTypeName = 'Bitcoin';
          else if (assetTypeNum === 2) assetTypeName = 'Algorand';
          else if (assetTypeNum === 3) assetTypeName = 'USDC';
          else if (assetTypeNum === 4) assetTypeName = 'Solana';

          console.log(`🌱 Portfolio Position Debug: Token ${tokenId}, Asset Type ${assetTypeNum} → ${assetTypeName}`);

          positions.push({
            tokenId: tokenId.toString(),
            owner: ownerAddress,
            ownerBase64: ownerBase64,
            assetType: assetTypeNum.toString(),
            assetTypeName: assetTypeName,
            holdings: (holdings.return || BigInt(0)).toString(),
            purchaseValue: (purchaseValue.return || BigInt(0)).toString(),
            portfolioTokenId: portfolioTokenId.toString()
          });
        } catch (error) {
          // Skip positions that cause errors (might be deleted or inaccessible)
          console.log(`Skipping position ${tokenId} due to error:`, error);
          continue;
        }
      }

      return {
        portfolioTokenId: portfolioTokenId.toString(),
        positionCount: positions.length,
        positions: positions,
        appId: this.PORTFOLIO_NFT_APP_ID
      };
    } catch (error) {
      console.error('Get portfolio positions error:', error);
      throw error;
    }
  }

  // =======================
  // DEBUG/ADMIN METHODS
  // =======================

  /**
   * Fund Portfolio NFT contract for box storage (debug/admin use)
   * Uses AlgoKit's localnet dispenser account (has lots of ALGO)
   */
  async fundPortfolioContract(amount: number = 100000) {
    try {
      // Get localnet dispenser account (has lots of ALGO)
      const dispenserAccount = await this.algorand.account.localNetDispenser();
      
      const factory = new CultivestPortfolioNftFactory({
        defaultSender: dispenserAccount.addr,
        algorand: this.algorand,
      });

      const appClient = factory.getAppClientById({
        appId: BigInt(this.PORTFOLIO_NFT_APP_ID)
      });

      const response = await this.algorand.send.payment({
        sender: dispenserAccount.addr.toString(),
        receiver: appClient.appAddress.toString(),
        amount: AlgoAmount.MicroAlgos(amount),
        signer: dispenserAccount.signer
      });

      return {
        transactionId: response.txIds[0],
        amount: amount,
        contractAddress: appClient.appAddress.toString(),
        appId: this.PORTFOLIO_NFT_APP_ID,
        dispenserAddress: dispenserAccount.addr.toString()
      };
    } catch (error) {
      console.error('Fund portfolio contract error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const nftContractService = new NFTContractService();