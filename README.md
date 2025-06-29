# Cultivest Backend

**Multi-Chain Micro-Investment Platform**

A Node.js/TypeScript backend API for Cultivest, a mobile-first micro-investment platform that enables users to invest small amounts ($1–$10) in Bitcoin and Algorand. Features custodial wallet management, Portfolio NFTs on Algorand for tracking investments, and future Chain Key self-custody opt-in. Built for the World's Largest Hackathon by Bolt.new.

## 🌟 Overview

Cultivest democratizes access to cryptocurrency investments for Gen Z, millennials, and unbanked users in emerging markets. The platform offers:

- **Micro-investments**: Start with as little as $1 in Bitcoin and Algorand
- **Portfolio NFTs**: Algorand-based NFTs track your entire investment portfolio
- **Custodial Security**: Professional custody with optional self-custody transition
- **Multi-chain Support**: Bitcoin (custodial) + Algorand (direct) with more chains coming
- **Gamified UX**: Visual portfolio growth with NFT-based achievements
- **Global accessibility**: Support for Nigeria, Argentina, and other emerging markets

## 🚀 Features

### Core Functionality
- **User Authentication**: Phone-based signup with OTP verification
- **Multi-Chain Wallet Management**: Custodial Bitcoin, Ethereum, Solana, Algorand wallets with AES-256 encryption
- **Portfolio NFT System**: Algorand NFTs track entire investment portfolios and individual positions
- **Unified Investment System**: Single endpoint handles all crypto purchases (BTC, ETH, SOL, ALGO, USDC) via MoonPay
- **Payment Integration**: MoonPay SDK with KYC handled during payment flow
- **Investment Tracking**: Real-time multi-chain balance monitoring and synchronization
- **Dashboard**: Multi-chain portfolio tracking, performance metrics, and gamified progress
- **Education**: Interactive content on cryptocurrency investing and custody options
- **AI Integration**: Claude 4-powered portfolio analysis and investment insights
- **Webhook Integration**: Automatic investment processing from MoonPay transactions

### Technical Features
- **Multi-chain Support**: Bitcoin, Ethereum, Solana, Algorand, USDC with unified investment endpoint
- **Payment Gateways**: MoonPay (all crypto types), Flutterwave (Nigeria)
- **NFT Infrastructure**: Algorand-based Portfolio NFTs with automatic minting on investments
- **Custody Management**: Secure private key storage for all supported chains
- **Compliance**: AML monitoring, transaction reporting, crypto custody regulations
- **Security**: AES-256 encryption, secure key derivation, multi-chain signing
- **Webhook Processing**: Automated investment creation from MoonPay completions

## 🛠 Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Bitcoin Core (via libraries), Algorand SDK, future Ethereum/Solana Web3.js
- **Authentication**: Supabase Auth with OTP
- **Payments**: MoonPay SDK (Bitcoin), Flutterwave API
- **NFTs**: Algorand ARC-69 standard with IPFS metadata storage
- **AI**: Claude 4 API for portfolio analysis and investment insights
- **Deployment**: Vercel (serverless functions)

## 📁 Project Structure

```
cultivest-backend/
├── app/api/                    # API endpoints
│   ├── auth/                   # Authentication routes
│   │   ├── login+api.ts
│   │   ├── signup+api.ts
│   │   └── verify-otp+api.ts
│   ├── users/                  # User-centric endpoints
│   │   └── invest+api.ts       # Unified investment endpoint
│   ├── deposit/                # Legacy deposit handling (DEPRECATED)
│   │   ├── initiate+api.ts     # ⚠️ DEPRECATED
│   │   └── webhook+api.ts      # MoonPay webhook handler
│   ├── investment/             # Legacy investment endpoints (DEPRECATED)
│   │   ├── initiate+api.ts     # ⚠️ DEPRECATED
│   │   └── positions+api.ts    # ⚠️ DEPRECATED
│   ├── wallet/                 # Wallet operations
│   │   └── balance+api.ts
│   ├── dashboard/              # Dashboard data
│   │   └── data+api.ts
│   ├── education/              # Educational content
│   │   ├── content+api.ts
│   │   └── quiz/submit+api.ts
│   ├── ai/                     # AI-powered features
│   │   └── roundup-suggestion+api.ts
│   └── ...                     # Additional endpoints
├── index.ts                    # Main server file
├── package.json
└── tsconfig.json
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- MoonPay API keys (publishable + secret)
- Algorand testnet access (via AlgoNode - no API key required)

### Environment Variables
Create a `.env` file with:

```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MOONPAY_API_KEY=your_moonpay_api_key
FLUTTERWAVE_SECRET_KEY=your_flutterwave_secret
ALGORAND_ALGOD_URL=https://testnet-algorand.api.purestake.io/ps2
ALGORAND_ALGOD_TOKEN=your_algorand_token
CLAUDE_API_KEY=your_claude_api_key
```

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cultivest-backend.git
cd cultivest-backend

# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📊 API Endpoints

### Authentication
- `POST /auth/signup` - Phone-based user registration
- `POST /auth/login` - User login with OTP
- `POST /auth/verify-otp` - OTP verification

### User Management
- `GET /user/profile` - Get user profile with custody status
- `POST /user/opt-in-self-custody` - Opt into Chain Key self-custody (Phase 2)
- Note: KYC is handled by MoonPay during payment flow

### Wallet & Transactions
- `POST /wallet/create` - Create multi-chain custodial wallets (Bitcoin, Ethereum, Solana, Algorand)
- `GET /wallet/balance` - Get live multi-chain balances with sync status
- `GET /wallet/balance/live/{address}` - Direct on-chain balance check for any supported chain
- `GET /wallet/bitcoin-address/{userID}` - Get user's Bitcoin wallet address
- `GET /wallet/algorand-address/{userID}` - Get user's Algorand wallet address
- ⚠️ `POST /deposit/initiate` - **DEPRECATED** - Use `/users/{userId}/invest` instead
- ⚠️ `GET /deposit/status/{id}` - **DEPRECATED** - Use investment tracking endpoints
- `POST /deposit/webhook` - Handle MoonPay transaction webhooks (all crypto types)
- `POST /withdrawal/initiate` - Start multi-chain withdrawal process
- `POST /withdrawal/webhook` - Handle withdrawal webhooks

### Investments (Unified System)
- `POST /users/{userId}/invest` - **UNIFIED** - Invest in any crypto (BTC, ETH, SOL, ALGO, USDC) with automatic NFT creation
- `GET /users/{userId}/investments` - Get user's investment summary and positions
- `GET /users/{userId}/investments/{positionTokenId}` - Get specific investment position details
- `GET /users/{userId}/portfolio` - Get user's portfolio NFT information
- `GET /users/{userId}/portfolio/positions` - Get all position NFTs in portfolio
- ⚠️ `POST /investment/initiate` - **DEPRECATED** - Use `/users/{userId}/invest` instead
- ⚠️ `GET /investment/positions` - **DEPRECATED** - Use `/users/{userId}/investments` instead
- ⚠️ `GET /investment/status/:positionId` - **DEPRECATED** - Use user-specific endpoints

### Dashboard & Data
- `GET /dashboard/data` - Get dashboard metrics
- `POST /notifications/send-daily-yield` - Send yield notifications

### Education & AI
- `GET /education/content` - Get educational materials
- `POST /education/quiz/submit` - Submit quiz answers
- `POST /ai/roundup-suggestion` - Get AI spending insights

### Development & Debug
- `GET /hello` - Health check endpoint
- `POST /debug/opt-in-usdca` - USDCa asset opt-in automation
- `GET /debug/algorand-status` - Network status and configuration
- `GET /debug/fund-testnet/status/{userId}` - Testnet funding status
- `POST /transaction/receipt/send` - Send transaction receipts

## 💡 Key Features Implementation

### Custodial Wallet Management
The platform uses custodial wallets to simplify user experience:
- Automatic Algorand wallet creation on signup
- Secure private key encryption with AES-256
- Multi-signature support for enhanced security

### Yield Generation
Integration with Tinyman DEX on Algorand:
- Automated USDCa investment in liquidity pools
- Real-time yield calculation and distribution
- Daily compound interest updates

### Gamified Dashboard
Visual progress tracking:
- "Money tree" animation growing with investments
- Badge system for milestones
- Daily yield notifications for engagement

### AI-Powered Insights
Claude 4 integration for:
- Spending pattern analysis
- Smart round-up suggestions
- Investment optimization recommendations
- AML compliance reporting

## 🔐 Security

- **Encryption**: AES-256 for sensitive data
- **Key Management**: Secure storage with HSM integration roadmap  
- **AML Compliance**: Chainalysis integration for transaction monitoring
- **Multi-signature**: Enhanced wallet security
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Comprehensive request sanitization

## 🌍 Target Markets

### Primary Users
- **Gen Z & Millennials** (18-35): Tech-savvy, seeking better returns than traditional savings
- **Emerging Markets**: Nigeria, Argentina, Turkey - users with limited banking access
- **Small Savers**: Individuals with $5-50/month to invest

### Geographic Focus
- **Nigeria**: 70% mobile penetration, 10% crypto adoption
- **Argentina**: 50% inflation driving stablecoin adoption  
- **Global**: English-speaking markets with banking access issues

## 📈 Business Model

### Revenue Streams
- **Transaction Fees**: 0.5-1% on deposits/withdrawals
- **Premium Tier**: $5/month for enhanced yields (4-5% vs 2-3%)
- **Referral Program**: User acquisition incentives
- **B2B Partnerships**: Revenue sharing with DeFi protocols

### Success Metrics
- **User Acquisition**: Target 100,000+ users in Year 1
- **Asset Under Management**: $10M+ in stablecoin deposits
- **Retention**: 30%+ monthly active users
- **Geographic Distribution**: 30% from emerging markets

## 🚧 Development Roadmap

### Phase 1A (Testnet Foundation - ✅ COMPLETED)
- ✅ Core API endpoints
- ✅ Basic authentication  
- ✅ Algorand wallet integration
- ✅ **Testnet funding workaround with faucets**
- ✅ **USDCa asset opt-in automation**
- ✅ **Balance detection with opt-in status**
- ✅ **MoonPay SDK integration (sandbox)**
- ✅ **TestnetFundingModal with Circle faucet**

### Phase 1B (Investment Core - In Progress)
- 🔄 Tinyman USDCa pool integration  
- 🔄 Investment backend APIs
- 🔄 Investment UI components
- 🔄 GENIUS Act risk disclaimer

### Phase 2 (Production Ready)
- 📋 Advanced security implementation
- 📋 Multi-chain support (Solana)
- 📋 Enhanced AI features
- 📋 Production deployment

### Phase 3 (Planned)
- 📋 Round-up investment automation
- 📋 Social features & referrals
- 📋 Advanced analytics dashboard
- 📋 Mobile app API integration

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test API endpoints
# Use api-tests.http for manual testing
```

## 🚀 Deployment

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### Environment Setup
- Configure environment variables in Vercel dashboard
- Set up Supabase production database
- Configure MoonPay/Flutterwave production APIs

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **World's Largest Hackathon by Bolt.new** - Competition inspiration
- **Algorand Foundation** - Blockchain infrastructure support
- **Anthropic** - Claude 4 AI integration
- **Supabase** - Backend-as-a-Service platform
- **MoonPay & Flutterwave** - Payment gateway partnerships

## 📞 Support

For questions or support:
- **Email**: support@cultivest.app
- **Twitter**: [@CultivestApp](https://twitter.com/CultivestApp)
- **Discord**: [Cultivest Community](https://discord.gg/cultivest)

---

**Built with ❤️ for financial inclusion and accessible investing**