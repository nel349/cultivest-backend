import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { CultivestPositionNftFactory } from '../artifacts/position-nft/CultivestPositionNFTClient'

// Deploy configuration for Cultivest Position NFT contract
export async function deploy() {
  console.log('=== Deploying CultivestPositionNFT ===')
  
  // Determine target network and configure client accordingly
  const isLocalNet = process.env.ALGORAND_NETWORK === 'localnet' || !process.env.ALGORAND_NETWORK
  const isTestNet = process.env.ALGORAND_NETWORK === 'testnet'
  
  let algorand: AlgorandClient
  let network: string
  
  if (isLocalNet) {
    algorand = AlgorandClient.fromEnvironment()
    network = 'localnet'
  } else if (isTestNet) {
    algorand = AlgorandClient.testNet()
    network = 'testnet'
  } else {
    algorand = AlgorandClient.mainNet()
    network = 'mainnet'
  }
  
  console.log(`🌐 Deploying to: ${network}`)
  console.log(`🔗 Network: ${process.env.ALGORAND_NETWORK || 'default-for-' + network}`)
  
  // Try AUTHORIZED_MINTER_MNEMONIC first, fallback to DEPLOYER_MNEMONIC
  const accountEnvVar = process.env.AUTHORIZED_MINTER_MNEMONIC ? 'AUTHORIZED_MINTER' : 'DEPLOYER'
  const deployer = await algorand.account.fromEnvironment(accountEnvVar)
  console.log(`📍 Authorized Minter/Deployer address: ${deployer.addr}`)
  console.log(`📋 Using account from: ${accountEnvVar}_MNEMONIC`)

  const factory = algorand.client.getTypedAppFactory(CultivestPositionNftFactory, {
    defaultSender: deployer.addr,
  })

  // Deploy with unique name and initialization
  const { appClient } = await factory.deploy({
    onUpdate: 'replace',
    onSchemaBreak: 'replace',
    createParams: {
      method: 'createApplication',
      args: []
    },
    // Force creation of new app by using a unique name each time
    appName: `CultivestPositionNFT-${Date.now()}`
  })

  // Fund the app account
  await algorand.send.payment({
    amount: (1).algo(),
    sender: deployer.addr,
    receiver: appClient.appAddress,
  })

  console.log('✅ Contract deployed and initialized successfully')

  console.log(`✅ Position NFT contract deployed with App ID: ${appClient.appClient.appId}`)
  console.log(`📍 App Address: ${appClient.appAddress}`)
  console.log('=== Position NFT Deployment Complete ===')
}