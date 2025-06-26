import { Config } from '@algorandfoundation/algokit-utils'
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { Address } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { CultivestPositionNftClient, CultivestPositionNftFactory } from '../artifacts/position-nft/CultivestPositionNFTClient'
import { CultivestPortfolioNftClient, CultivestPortfolioNftFactory } from '../artifacts/portfolio-nft/CultivestPortfolioNFTClient'

describe('Position + Portfolio NFT Integration Tests', () => {
  const localnet = algorandFixture()
  beforeAll(() => {
    Config.configure({
      debug: true,
      // traceAll: true,
    })
    registerDebugEventHandlers()
  })
  beforeEach(localnet.newScope)

  const deployPositionNFT = async (account: Address) => {
    const factory = localnet.algorand.client.getTypedAppFactory(CultivestPositionNftFactory, {
      defaultSender: account,
    })

    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
      createParams: {
        method: 'createApplication',
        args: []
      }
    })
    return { positionClient: appClient }
  }

  const deployPortfolioNFT = async (account: Address) => {
    const factory = localnet.algorand.client.getTypedAppFactory(CultivestPortfolioNftFactory, {
      defaultSender: account,
    })

    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
      createParams: {
        method: 'createApplication',
        args: []
      }
    })
    return { portfolioClient: appClient }
  }

  const fundContract = async (client: CultivestPortfolioNftClient, sender: Address) => {
    await localnet.algorand.send.payment({
      sender: sender.toString(),
      receiver: client.appAddress.toString(),
      amount: (1).algo()
    })
  }

  test('Complete investment flow: deploy contracts, mint position, create portfolio, link them', async () => {
    const { testAccount } = localnet.context
    
    // Deploy both contracts
    const { positionClient } = await deployPositionNFT(testAccount)
    const { portfolioClient } = await deployPortfolioNFT(testAccount)
    
    // Fund portfolio contract for box storage
    await fundContract(portfolioClient, testAccount)

    console.log('Position NFT App ID:', positionClient.appId.toString())
    console.log('Portfolio NFT App ID:', portfolioClient.appId.toString())

    // Step 1: Mint a position token (Bitcoin investment)
    const mintPositionResult = await positionClient.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n, // Bitcoin
        holdings: 100000000n, // 1 BTC (8 decimals)
        purchaseValueUsd: 5000000n // $50,000 (2 decimals as cents)
      }
    })

    const positionTokenId = mintPositionResult.return!
    expect(positionTokenId).toBe(1n)
    console.log('Position Token ID:', positionTokenId.toString())

    // Step 2: Mint a portfolio token  
    const mintPortfolioResult = await portfolioClient.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 1n,
        metadataCid: 'QmExamplePortfolioMetadata123'
      }
    })

    const portfolioTokenId = mintPortfolioResult.return!
    expect(portfolioTokenId).toBe(1n)
    console.log('Portfolio Token ID:', portfolioTokenId.toString())

    // Step 3: Add position to portfolio
    await portfolioClient.send.addPositionToPortfolio({
      args: {
        portfolioTokenId: portfolioTokenId,
        positionTokenId: positionTokenId,
        owner: testAccount.addr.toString()
      }
    })

    // Step 4: Verify the integration
    
    // Check that position knows which portfolio it belongs to
    const positionPortfolio = await portfolioClient.send.getPositionPortfolio({
      args: { positionTokenId: positionTokenId }
    })
    expect(positionPortfolio.return).toBe(portfolioTokenId)

    // Check that portfolio knows how many positions it has
    const portfolioPositionCount = await portfolioClient.send.getPortfolioPositionCount({
      args: { portfolioTokenId: portfolioTokenId }
    })
    expect(portfolioPositionCount.return).toBe(1n)

    console.log('✅ Integration test passed: Position linked to Portfolio successfully')
  })

  test('Multiple positions in one portfolio', async () => {
    const { testAccount } = localnet.context
    
    // Deploy both contracts
    const { positionClient } = await deployPositionNFT(testAccount)
    const { portfolioClient } = await deployPortfolioNFT(testAccount)
    
    // Fund portfolio contract
    await fundContract(portfolioClient, testAccount)

    // Create portfolio first
    const portfolioResult = await portfolioClient.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 2n,
        metadataCid: 'QmMultiPositionPortfolio456'
      }
    })
    const portfolioTokenId = portfolioResult.return!

    // Mint 3 different position tokens
    const positions = [
      { assetType: 1n, holdings: 50000000n, purchaseValueUsd: 2500000n }, // 0.5 BTC
      { assetType: 2n, holdings: 100000000n, purchaseValueUsd: 30000n },  // 1000 ALGO  
      { assetType: 3n, holdings: 100000n, purchaseValueUsd: 100000n }      // 1000 USDC
    ]

    const positionTokenIds = []
    for (let i = 0; i < positions.length; i++) {
      const result = await positionClient.send.mintPosition({
        args: {
          owner: testAccount.addr.toString(),
          ...positions[i]
        }
      })
      positionTokenIds.push(result.return!)
      
      // Add each position to the portfolio
      await portfolioClient.send.addPositionToPortfolio({
        args: {
          portfolioTokenId: portfolioTokenId,
          positionTokenId: result.return!,
          owner: testAccount.addr.toString()
        }
      })
    }

    // Verify all positions are in the portfolio
    const finalCount = await portfolioClient.send.getPortfolioPositionCount({
      args: { portfolioTokenId: portfolioTokenId }
    })
    expect(finalCount.return).toBe(3n)

    // Verify each position knows its portfolio
    for (const positionId of positionTokenIds) {
      const portfolio = await portfolioClient.send.getPositionPortfolio({
        args: { positionTokenId: positionId }
      })
      expect(portfolio.return).toBe(portfolioTokenId)
    }

    console.log('✅ Multi-position portfolio test passed')
  })

  test('Remove position from portfolio', async () => {
    const { testAccount } = localnet.context
    
    // Setup: Deploy contracts, create portfolio with 2 positions
    const { positionClient } = await deployPositionNFT(testAccount)
    const { portfolioClient } = await deployPortfolioNFT(testAccount)
    await fundContract(portfolioClient, testAccount)

    // Create portfolio
    const portfolioResult = await portfolioClient.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 1n,
        metadataCid: 'QmRemoveTestPortfolio'
      }
    })
    const portfolioTokenId = portfolioResult.return!

    // Add 2 positions
    const position1 = await positionClient.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 100000000n,
        purchaseValueUsd: 5000000n
      }
    })
    const position2 = await positionClient.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 2n,
        holdings: 200000000n,
        purchaseValueUsd: 60000n
      }
    })

    await portfolioClient.send.addPositionToPortfolio({
      args: { portfolioTokenId, positionTokenId: position1.return!, owner: testAccount.addr.toString() }
    })
    await portfolioClient.send.addPositionToPortfolio({
      args: { portfolioTokenId, positionTokenId: position2.return!, owner: testAccount.addr.toString() }
    })

    // Verify we have 2 positions
    let count = await portfolioClient.send.getPortfolioPositionCount({
      args: { portfolioTokenId }
    })
    expect(count.return).toBe(2n)

    // Remove one position
    await portfolioClient.send.removePositionFromPortfolio({
      args: {
        portfolioTokenId,
        positionTokenId: position1.return!,
        owner: testAccount.addr.toString()
      }
    })

    // Verify count decreased
    count = await portfolioClient.send.getPortfolioPositionCount({
      args: { portfolioTokenId }
    })
    expect(count.return).toBe(1n)

    // Verify removed position no longer belongs to portfolio
    const removedPositionPortfolio = await portfolioClient.send.getPositionPortfolio({
      args: { positionTokenId: position1.return! }
    })
    expect(removedPositionPortfolio.return).toBe(0n) // 0 means no portfolio

    // Verify remaining position still belongs to portfolio
    const remainingPositionPortfolio = await portfolioClient.send.getPositionPortfolio({
      args: { positionTokenId: position2.return! }
    })
    expect(remainingPositionPortfolio.return).toBe(portfolioTokenId)

    console.log('✅ Remove position test passed')
  })

  test('Cannot add position to multiple portfolios', async () => {
    const { testAccount } = localnet.context
    
    const { positionClient } = await deployPositionNFT(testAccount)
    const { portfolioClient } = await deployPortfolioNFT(testAccount)
    await fundContract(portfolioClient, testAccount)

    // Create 2 portfolios
    const portfolio1 = await portfolioClient.send.mintPortfolio({
      args: { owner: testAccount.addr.toString(), level: 1n, metadataCid: 'QmPortfolio1' }
    })
    const portfolio2 = await portfolioClient.send.mintPortfolio({
      args: { owner: testAccount.addr.toString(), level: 1n, metadataCid: 'QmPortfolio2' }
    })

    // Create 1 position
    const position = await positionClient.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 100000000n,
        purchaseValueUsd: 5000000n
      }
    })

    // Add position to first portfolio (should succeed)
    await portfolioClient.send.addPositionToPortfolio({
      args: {
        portfolioTokenId: portfolio1.return!,
        positionTokenId: position.return!,
        owner: testAccount.addr.toString()
      }
    })

    // Try to add same position to second portfolio (should fail)
    await expect(
      portfolioClient.send.addPositionToPortfolio({
        args: {
          portfolioTokenId: portfolio2.return!,
          positionTokenId: position.return!,
          owner: testAccount.addr.toString()
        }
      })
    ).rejects.toThrow("Position already assigned to a portfolio")

    console.log('✅ Duplicate position prevention test passed')
  })
})