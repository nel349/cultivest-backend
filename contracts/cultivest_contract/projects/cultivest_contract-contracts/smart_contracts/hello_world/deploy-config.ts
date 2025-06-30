import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HelloWorldFactory } from '../artifacts/hello_world/HelloWorldClient'

// Below is a showcase of various deployment options you can use in TypeScript Client
export async function deploy() {
  console.log('=== Deploying HelloWorld ===')

  // Determine target network and configure client accordingly
  const isLocalNet = process.env.ALGORAND_NETWORK?.includes('localhost') || !process.env.ALGOD_SERVER
  const isTestNet = process.env.ALGORAND_NETWORK?.includes('testnet')
  
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
  console.log(`🔗 Algod server: ${process.env.ALGORAND_NETWORK || 'default-for-' + network}`)
  
  // Try AUTHORIZED_MINTER_MNEMONIC first, fallback to DEPLOYER_MNEMONIC
  const accountEnvVar = process.env.AUTHORIZED_MINTER_MNEMONIC ? 'AUTHORIZED_MINTER' : 'DEPLOYER'
  const deployer = await algorand.account.fromEnvironment(accountEnvVar)
  console.log(`📍 Authorized Minter/Deployer address: ${deployer.addr}`)
  console.log(`📋 Using account from: ${accountEnvVar}_MNEMONIC`)

  const factory = algorand.client.getTypedAppFactory(HelloWorldFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({ onUpdate: 'append', onSchemaBreak: 'append' })

  // If app was just created fund the app account
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  const method = 'hello'  
  const response = await appClient.send.hello({
    args: { name: 'world' },
  })
  console.log(
    `Called ${method} on ${appClient.appClient.appName} (${appClient.appClient.appId}) with name = world, received: ${response.return}`,
  )
}
