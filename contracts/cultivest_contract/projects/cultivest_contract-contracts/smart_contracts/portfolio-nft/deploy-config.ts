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

  // Deploy using the deploy method with createParams
  const { appClient, result } = await factory.deploy({ 
    onUpdate: 'append', 
    onSchemaBreak: 'append',
    createParams: {
      method: 'createApplication',
      args: []
    }
  })

  // If app was just created fund the app account
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  console.log(`✅ Portfolio NFT contract deployed with App ID: ${appClient.appClient.appId}`)
  console.log(`📍 App Address: ${appClient.appAddress}`)
  
  console.log('=== Portfolio NFT Deployment Complete ===')
  return { appClient, appId: appClient.appClient.appId }
}