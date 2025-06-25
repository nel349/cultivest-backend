# 🚀 Cultivest Smart Contracts Guide

## 📁 Project Structure

```
cultivest-backend/
├── contracts/
│   └── cultivest_contract/              # AlgoKit workspace project
│       ├── .algokit.toml               # AlgoKit configuration
│       ├── projects/
│       │   ├── cultivest_contract-contracts/  # Smart contract code
│       │   │   ├── smart_contracts/           # TEALscript contracts
│       │   │   ├── package.json              # Contract dependencies
│       │   │   └── README.md                 # Contract-specific docs
│       │   └── cultivest_contract-frontend/   # Contract frontend (optional)
│       └── README.md                   # Workspace documentation
├── docs/
│   ├── TEALSCRIPT_CRASH_COURSE.md     # TEALscript learning guide
│   └── SMART_CONTRACTS_GUIDE.md       # This file
└── ...
```

## 🎯 What This Contains

Your `cultivest_contract` directory is a complete **AlgoKit workspace** that includes:

### **Smart Contracts (TEALscript)**
- Portfolio NFT contracts for tracking multi-chain investments
- Position NFT contracts for individual asset tracking
- Integration with your existing Bitcoin + Algorand infrastructure

### **Development Environment**
- LocalNet deployment for testing
- TestNet deployment for integration
- MainNet deployment for production

## 🏗️ Architecture Integration

```
┌─────────────────────────────────────────────────────────────┐
│                  CULTIVEST ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│  Backend API (cultivest-backend/)                           │
│  ├── MoonPay Bitcoin integration                            │
│  ├── Multi-chain wallet management                          │
│  ├── Supabase database                                      │
│  └── REST API endpoints                                     │
├─────────────────────────────────────────────────────────────┤
│  Smart Contracts (contracts/cultivest_contract/)            │
│  ├── Portfolio NFT: Tracks total investment value           │
│  ├── Position NFTs: Individual BTC/ALGO/USDC positions      │
│  ├── Achievement system: Gamified milestones                │
│  └── Cross-chain aggregation                                │
├─────────────────────────────────────────────────────────────┤
│  React Native App (cultivest-react-native/)                 │
│  ├── Displays NFT portfolio data                            │
│  ├── Shows money tree levels                                │
│  └── Real-time multi-chain balances                         │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### **Prerequisites**
```bash
# Ensure you have the right versions
node --version    # Should be v22.x.x
npm --version     # Should be 10.x.x+
algokit --version # Should be latest

# Install AlgoKit if needed
brew install algorandfoundation/tap/algokit
```

### **Development Setup**
```bash
# 1. Navigate to the contract project
cd cultivest-backend/contracts/cultivest_contract

# 2. Install dependencies
npm install

# 3. Start LocalNet for testing
algokit localnet start

# 4. Deploy contracts to LocalNet
algokit project deploy localnet

# 5. Run tests
npm test
```

### **Production Deployment**
```bash
# Deploy to TestNet (for integration testing)
algokit project deploy testnet

# Deploy to MainNet (for production)
algokit project deploy mainnet
```

## 📋 Available Commands

### **In cultivest_contract/ directory:**
```bash
# Workspace management
algokit project bootstrap all    # Install all dependencies
algokit project run build       # Build all contracts

# LocalNet operations
algokit localnet start          # Start local Algorand network
algokit localnet stop           # Stop local network
algokit localnet status         # Check network status
algokit localnet reset          # Reset network state

# Deployment
algokit project deploy localnet # Deploy to local network
algokit project deploy testnet  # Deploy to TestNet
algokit project deploy mainnet  # Deploy to MainNet

# Development
npm run build                   # Build contracts
npm run test                    # Run contract tests
npm run lint                    # Check code quality
```

### **In cultivest_contract-contracts/ directory:**
```bash
# Contract-specific commands
npm run build                   # Compile TEALscript contracts
npm run test                    # Run unit tests
npm run deploy:ci               # Deploy in CI environment
npm run generate:client         # Generate TypeScript client
```

## 🔧 Configuration Files

### **.algokit.toml** (Workspace Config)
```toml
[algokit]
min_version = "v2.0.0"

[project]
type = 'workspace'
projects_root_path = 'projects'

[project.run]
build = ['cultivest_contract-contracts', 'cultivest_contract-frontend']
```

### **package.json** (Contract Dependencies)
Key dependencies for TEALscript development:
- `@algorandfoundation/tealscript`
- `@algorandfoundation/algokit-utils`
- `algosdk`

## 🔗 Backend Integration

### **Contract Deployment Config**
After deployment, contract IDs are stored in:
```json
// config/algorand-contracts.json
{
  "network": "testnet",
  "portfolioContract": 123456789,
  "positionContractTemplate": 987654321,
  "deployedAt": "2024-12-20T10:30:00Z"
}
```

### **Backend API Integration**
```typescript
// utils/algorand-nft.ts
import contractConfig from '../config/algorand-contracts.json';

export class CultivestNFTManager {
  async createPortfolioNFT(userID: string): Promise<number> {
    // Use deployed contract IDs
    const appId = await deployContract(contractConfig.portfolioContract);
    return appId;
  }
}
```

## 📊 Contract Functionality

### **Portfolio NFT Contract**
- **Purpose**: Master NFT representing user's entire portfolio
- **Features**:
  - Tracks total USD value across BTC/ALGO/USDC
  - Manages money tree levels (1-5)
  - Calculates unrealized P&L
  - Emits events for off-chain indexing

### **Position NFT Contracts**
- **Purpose**: Individual NFTs for each cryptocurrency position
- **Features**:
  - Tracks quantity and entry price
  - Updates with current market prices
  - Calculates position-specific P&L
  - Supports partial buys/sells

### **Achievement System**
- **Purpose**: Gamified milestones tracked on-chain
- **Examples**:
  - First Investment ($1+)
  - Diversification (BTC + ALGO)
  - Money Tree Levels
  - Diamond Hands (30+ days)

## 🐛 Troubleshooting

### **Common Issues:**

**1. `ECONNREFUSED` Error**
```bash
# LocalNet not running
algokit localnet start
```

**2. Node Version Issues**
```bash
# Upgrade to Node.js v22+
nvm install 22
nvm use 22
```

**3. Deployment Failures**
```bash
# Reset and restart LocalNet
algokit localnet reset
algokit localnet start
```

**4. Contract Compilation Errors**
```bash
# Clean build
cd projects/cultivest_contract-contracts
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📈 Development Workflow

### **Recommended Development Flow:**
1. **Develop locally**: Use LocalNet for fast iteration
2. **Test integration**: Deploy to TestNet, connect with backend
3. **Update frontend**: Connect React Native to contract data
4. **Production deploy**: Deploy to MainNet when ready

### **Testing Strategy:**
```bash
# 1. Unit test contracts
npm run test

# 2. Integration test with backend
algokit project deploy testnet
# Run your backend integration tests

# 3. End-to-end test with frontend
# Test React Native app with TestNet contracts
```

## 🔐 Security Considerations

### **Development vs Production:**
- **LocalNet**: Use test mnemonics, unlimited ALGO
- **TestNet**: Use test mnemonics, request test ALGO from faucet
- **MainNet**: Use secure key management (HSM, KMS)

### **Key Management:**
```bash
# Development
export DEPLOYER_MNEMONIC="your test mnemonic..."

# Production (use secure secret management)
export DEPLOYER_MNEMONIC_PROD="$(aws ssm get-parameter --name /cultivest/deployer --with-decryption --query Parameter.Value --output text)"
```

## 🔄 Integration with Existing Backend

Your smart contracts complement your existing infrastructure:

### **Current Backend (Continues Working):**
- ✅ Phone signup with SMS OTP
- ✅ MoonPay Bitcoin purchases
- ✅ Multi-chain custodial wallets
- ✅ Real-time balance tracking
- ✅ Supabase database

### **Smart Contracts Add:**
- 🆕 NFT portfolio representation
- 🆕 Money tree gamification
- 🆕 Achievement system
- 🆕 Cross-chain portfolio aggregation
- 🆕 Immutable investment history

### **No Breaking Changes:**
Your existing API endpoints continue working. Smart contracts are **additive functionality** that enhance the user experience with NFT portfolio tracking.

## 📚 Next Steps

1. **Document your contracts**: Add details about your specific TEALscript implementations
2. **Update main README**: Reference this smart contract system
3. **Integration testing**: Connect contracts with your existing backend APIs
4. **Frontend updates**: Display NFT data in your React Native app

## 🤝 Contributing

When working on smart contracts:
1. Test changes on LocalNet first
2. Deploy to TestNet for integration testing
3. Run full test suite before MainNet deployment
4. Update contract documentation when adding features

---

**🎯 This smart contract system transforms Cultivest into the first NFT-powered Bitcoin + Algorand investment platform!** 