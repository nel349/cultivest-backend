import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { CultivestPortfolioNftFactory } from '../artifacts/portfolio-nft/CultivestPortfolioNFTClient'

// Deploy configuration for Cultivest Portfolio NFT contract
export async function deploy() {
  console.log('=== Deploying CultivestPortfolioNFT ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(CultivestPortfolioNftFactory, {
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
    appName: `CultivestPortfolioNFT-${Date.now()}`
  })

  // Fund the app account
  await algorand.send.payment({
    amount: (1).algo(),
    sender: deployer.addr,
    receiver: appClient.appAddress,
  })

  console.log('✅ Contract deployed and initialized successfully');

  console.log(`✅ Portfolio NFT contract deployed with App ID: ${appClient.appClient.appId}`)
  console.log(`📍 App Address: ${appClient.appAddress}`)
  
  console.log('=== Portfolio NFT Deployment Complete ===')
  return { appClient, appId: appClient.appClient.appId }
}