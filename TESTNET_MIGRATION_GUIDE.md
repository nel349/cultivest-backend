# 🚀 Testnet Migration Guide

This guide will help you migrate your Cultivest backend from Algorand LocalNet to TestNet.

## ✅ **Changes Made**

The following files have been updated to support testnet:
- `cultivest-backend/utils/wallet.ts` - Updated funding logic for testnet
- `cultivest-backend/services/nft-contract.service.ts` - Dynamic network configuration  
- `cultivest-backend/app/api/smart-contract+api.ts` - Dynamic network configuration

## 🔧 **Step 1: Environment Configuration**

Update your `.env` file with testnet settings:

```env
# Algorand Network Configuration - TESTNET
ALGORAND_ALGOD_URL=https://testnet-api.algonode.cloud
ALGORAND_ALGOD_TOKEN=
ALGORAND_NETWORK=testnet
USDC_ASSET_ID=10458941

# Smart Contract Configuration (deploy these first)
POSITION_NFT_APP_ID=your_position_nft_app_id_here
PORTFOLIO_NFT_APP_ID=your_portfolio_nft_app_id_here

# Testnet Account for Contract Deployment & Auto-funding
DEPLOYER_MNEMONIC=your_funded_testnet_account_mnemonic
TESTNET_DISPENSER_MNEMONIC=your_funded_testnet_account_mnemonic

# Keep your existing configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MOONPAY_API_KEY=your_moonpay_api_key
MOONPAY_SECRET_KEY=your_moonpay_secret_key
FLUTTERWAVE_SECRET_KEY=your_flutterwave_secret
CLAUDE_API_KEY=your_claude_api_key
ENCRYPTION_KEY=your_encryption_key
JWT_SECRET=your_jwt_secret
```

## 💰 **Step 2: Get Testnet Funds**

1. **Create a testnet account:**
   ```bash
   # Use algokit to generate a new account
   algokit goal account new --name testnet-deployer
   ```

2. **Fund your account from the Algorand testnet faucet:**
   - Visit: https://testnet.algoexplorer.io/dispenser
   - Enter your testnet address
   - Request 50 ALGOs (recommended for contract deployments)

3. **Export your mnemonic:**
   ```bash
   algokit goal account export --address YOUR_TESTNET_ADDRESS
   ```

## 🏗️ **Step 3: Create Testnet Environment for Smart Contracts**

Navigate to the smart contracts directory:
```bash
cd cultivest-backend/contracts/cultivest_contract/projects/cultivest_contract-contracts
```

Create a `.env.testnet` file:
```env
# Testnet Environment Variables for Smart Contract Deployment
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_PORT=443
ALGOD_TOKEN=
INDEXER_SERVER=https://testnet-indexer.algonode.cloud
INDEXER_PORT=443
INDEXER_TOKEN=

# Deployer account (funded with testnet ALGOs)
DEPLOYER_MNEMONIC=your_funded_testnet_account_mnemonic
```

## 🚀 **Step 4: Deploy Smart Contracts to Testnet**

1. **Build the contracts:**
   ```bash
   npm run build
   ```

2. **Deploy to testnet:**
   ```bash
   algokit project deploy testnet
   ```

3. **Note the App IDs:**
   The deployment will output App IDs like:
   ```
   ✅ Position NFT contract deployed with App ID: 123456789
   ✅ Portfolio NFT contract deployed with App ID: 987654321
   ```

4. **Update your backend `.env` file:**
   ```env
   POSITION_NFT_APP_ID=123456789
   PORTFOLIO_NFT_APP_ID=987654321
   ```

## 🔍 **Step 5: Verify Deployment**

1. **Check contract status:**
   ```bash
   # Test the debug endpoint
   curl http://localhost:3000/api/v1/debug/algorand-status
   ```

2. **Test smart contract interaction:**
   ```bash
   # Test hello world contract
   curl -X POST http://localhost:3000/api/v1/smart-contract/hello-world \
     -H "Content-Type: application/json" \
     -d '{"name": "TestNet", "userId": "your-test-user-id"}'
   ```

## 🎛️ **Step 6: Frontend Configuration (if using)**

If you're using the frontend contracts, update the environment variables:

Navigate to: `cultivest-backend/contracts/cultivest_contract/projects/cultivest_contract-frontend`

Create a `.env` file:
```env
VITE_ENVIRONMENT=testnet
VITE_ALGOD_SERVER=https://testnet-api.algonode.cloud
VITE_ALGOD_PORT=443
VITE_ALGOD_TOKEN=
VITE_ALGOD_NETWORK=testnet
VITE_INDEXER_SERVER=https://testnet-indexer.algonode.cloud
VITE_INDEXER_PORT=443
VITE_INDEXER_TOKEN=
```

## 🧪 **Step 7: Test the Migration**

1. **Test wallet creation:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/wallet/create \
     -H "Content-Type: application/json" \
     -d '{"userId": "test-user-123"}'
   ```

2. **Test balance fetching:**
   ```bash
   curl "http://localhost:3000/api/v1/wallet/balance?userId=test-user-123&live=true"
   ```

3. **Test NFT endpoints:**
   ```bash
   curl "http://localhost:3000/api/v1/nft/portfolio/stats?userId=test-user-123"
   ```

## ⚠️ **Important Notes**

### **Auto-funding Behavior:**
- **LocalNet**: Uses AlgoKit dispenser (5 ALGO)
- **TestNet**: Uses your `TESTNET_DISPENSER_MNEMONIC` account (1 ALGO)
- **MainNet**: No auto-funding (users fund manually)

### **USDCa Asset ID:**
- **TestNet**: `10458941`
- **MainNet**: `31566704`

### **Network Detection:**
The system automatically detects the network from `ALGORAND_NETWORK` environment variable and adjusts behavior accordingly.

## 🔧 **Troubleshooting**

### **"No testnet dispenser account configured"**
Set `TESTNET_DISPENSER_MNEMONIC` in your `.env` file with a funded testnet account.

### **"Contract not found" errors**
Make sure you've deployed the contracts and updated the App IDs in your `.env` file.

### **Balance fetching issues**
Verify your testnet node URL is correct: `https://testnet-api.algonode.cloud`

### **Funding failures**
- Check your dispenser account balance on https://testnet.algoexplorer.io
- Ensure you have at least 2-3 ALGO for multiple transactions

## 📈 **Next Steps**

1. **Update your mobile app** to point to the updated backend
2. **Test investment flows** with small amounts on testnet
3. **Monitor contract performance** using AlgoExplorer testnet
4. **Plan mainnet deployment** once testing is complete

## 🌐 **Useful Links**

- **Testnet Faucet**: https://testnet.algoexplorer.io/dispenser  
- **Testnet Explorer**: https://testnet.algoexplorer.io
- **AlgoNode Testnet**: https://testnet-api.algonode.cloud
- **USDCa on TestNet**: https://testnet.algoexplorer.io/asset/10458941

---

✅ **Your backend is now configured for Algorand TestNet!** 