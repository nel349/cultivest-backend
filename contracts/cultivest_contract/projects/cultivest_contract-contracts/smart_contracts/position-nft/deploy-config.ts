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