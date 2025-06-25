import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { CultivestPositionNftFactory } from '../artifacts/position-nft/CultivestPositionNFTClient'

// Deploy configuration for Cultivest Position NFT contract
export async function deploy() {
  console.log('=== Deploying CultivestPositionNFT ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(CultivestPositionNftFactory, {
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

  console.log(`✅ Position NFT contract deployed with App ID: ${appClient.appClient.appId}`)
  console.log(`📍 App Address: ${appClient.appAddress}`)
  
  console.log('=== Position NFT Deployment Complete ===')
  return { appClient, appId: appClient.appClient.appId }
}