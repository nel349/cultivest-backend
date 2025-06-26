import { Config } from '@algorandfoundation/algokit-utils'
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import algosdk, { Address } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { CultivestPortfolioNftClient, CultivestPortfolioNftFactory } from '../artifacts/portfolio-nft/CultivestPortfolioNFTClient'
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client'

describe('CultivestPortfolioNFT E2E Tests', () => {
  const localnet = algorandFixture()
  beforeAll(() => {
    Config.configure({
      debug: true,
      // traceAll: true,
    })
    registerDebugEventHandlers()
  })
  beforeEach(localnet.newScope)

  const deploy = async (account: Address) => {
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
    return { client: appClient }
  }

  test('deploys successfully and has correct initial state', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    const stats = await client.send.getContractStats({ args: {} })
    
    expect(stats.return![0]).toBe(0n) // Total tokens minted
    expect(stats.return![1]).toBe(0n) // Current supply
    expect(stats.return![2]).toBe(100000n) // Max supply
    expect(stats.return![3]).toBe(1n) // Contract version
    expect(stats.return![4]).toBe(0n) // Position NFT app ID (not set yet)
  })

  const fundContract = async (client: CultivestPortfolioNftClient, sender: Address) => {
    await localnet.algorand.send.payment({
      sender: sender.toString(),
      receiver: client.appAddress.toString(),
      amount: (1).algo()
    })
  }

  test('mints portfolio NFT successfully', async () => {
    const testAccount = await localnet.context.generateAccount({ initialFunds: (2).algo() })
    const { client } = await deploy(testAccount)

    await fundContract(client, testAccount)
    // Mint a portfolio token
    const result = await client.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 1n,
        metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh'
      }
    })

    expect(result.return).toBe(1n) // First token ID should be 1

    // Check contract stats
    const stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![0]).toBe(1n) // Total tokens minted
    expect(stats.return![1]).toBe(1n) // Current supply

    const portfolioExists = await client.send.portfolioExists({ args: { portfolioTokenId: 1n } })
    expect(portfolioExists.return).toBe(true)

    // Lets check the box storage
    const portfolioCount = await client.send.getPortfolioCountForOwner({ args: { tokenId: 1n } })
    expect(portfolioCount.return).toBe(0n)

    const portfolioOwnerBytes = await client.send.getPortfolioOwner({ args: { tokenId: 1n } })

    // use algo encoding to decode the address
    const ownerBytes = portfolioOwnerBytes.return!
    const address = algosdk.encodeAddress(new Uint8Array(ownerBytes))
    expect(address).toBe(testAccount.addr.toString())
    console.log('portfolioOwner vs: ', address, testAccount.addr.toString())

    const portfolioLevel = await client.send.getPortfolioLevel({ args: { tokenId: 1n } })
    expect(portfolioLevel.return).toBe(1n)

    const portfolioMetadataCID = await client.send.getPortfolioMetadataCid({ args: { tokenId: 1n } })
    expect(portfolioMetadataCID.return).toBe('QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh')
  })

  test('mints multiple portfolio NFTs with different levels', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    await fundContract(client, testAccount)

    // Mint portfolios with different levels

    const threeRandomCids = [
      'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh',
      'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLs',
      'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLm',
    ]
    const portfolios = [
      { level: 1n, metadataCid: threeRandomCids[0] },   // $5.00
      { level: 3n, metadataCid: threeRandomCids[1] },  // $25.00
      { level: 5n, metadataCid: threeRandomCids[2] }, // $150.00
    ]

    for (let i = 0; i < portfolios.length; i++) {
      const result = await client.send.mintPortfolio({
        args: {
          owner: testAccount.addr.toString(),
          level: portfolios[i].level,
          metadataCid: portfolios[i].metadataCid
        }
      })
      expect(result.return).toBe(BigInt(i + 1))

      const portfolioCount = await client.send.getPortfolioCountForOwner({ args: { tokenId: result.return! } })
      expect(portfolioCount.return).toBe(0n)

      const portfolioOwnerBytes = await client.send.getPortfolioOwner({ args: { tokenId: result.return! } })
      const ownerBytes = portfolioOwnerBytes.return!
      const address = algosdk.encodeAddress(new Uint8Array(ownerBytes))
      expect(address).toBe(testAccount.addr.toString())

      const portfolioLevel = await client.send.getPortfolioLevel({ args: { tokenId: result.return! } })
      expect(portfolioLevel.return).toBe(portfolios[i].level)

      const portfolioMetadataCID = await client.send.getPortfolioMetadataCid({ args: { tokenId: result.return! } })
      expect(portfolioMetadataCID.return).toBe(portfolios[i].metadataCid)
      
    }

    // Check final stats
    const stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![0]).toBe(3n) // Total tokens minted
    expect(stats.return![1]).toBe(3n) // Current supply
  })

  test('adds position to portfolio successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint a portfolio
    const portfolioResult = await client.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 2n,
        metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh'
      }
    })
    const portfolioTokenId = portfolioResult.return!

    // Add position to portfolio
    await client.send.addPositionToPortfolio({
      args: {
        portfolioTokenId,
        positionTokenId: 101n, // Bitcoin position
        owner: testAccount.addr.toString()
      }
    })

    // Add another position
    await client.send.addPositionToPortfolio({
      args: {
        portfolioTokenId,
        positionTokenId: 102n, // Algorand position
        owner: testAccount.addr.toString()
      }
    })

    // Should complete without errors
    expect(portfolioTokenId).toBe(1n)
  })

  test('removes position from portfolio successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint portfolio and add positions
    const portfolioResult = await client.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 2n,
        metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh'
      }
    })
    const portfolioTokenId = portfolioResult.return!

    // Add positions
    await client.send.addPositionToPortfolio({
      args: { portfolioTokenId, positionTokenId: 101n, owner: testAccount.addr.toString() }
    })
    await client.send.addPositionToPortfolio({
      args: { portfolioTokenId, positionTokenId: 102n, owner: testAccount.addr.toString() }
    })

    // Remove one position
    await client.send.removePositionFromPortfolio({
      args: {
        portfolioTokenId,
        positionTokenId: 102n,
        owner: testAccount.addr.toString()
      }
    })

    // Should complete without errors
    expect(portfolioTokenId).toBe(1n)
  })

  test('updates portfolio values successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint portfolio
    const portfolioResult = await client.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 1n,
        metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh'
      }
    })
    const portfolioTokenId = portfolioResult.return!

    // Update portfolio values
    await client.send.updatePortfolio({
      args: {
        portfolioTokenId,
        newLevel: 3n,
        newMetadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh'
      }
    })

    // Should complete without errors
    expect(portfolioTokenId).toBe(1n)
  })

  test('transfers portfolio ownership successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const secondAccount = await localnet.context.generateAccount({ initialFunds: (1).algo() })

    // Mint portfolio
    const portfolioResult = await client.send.mintPortfolio({
      args: {
        owner: testAccount.addr.toString(),
        level: 1n,
        metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh'
      }
    })
    const portfolioTokenId = portfolioResult.return!

    // Transfer ownership
    await client.send.transferPortfolio({
      args: {
        portfolioTokenId,
        currentOwner: testAccount.addr.toString(),
        newOwner: secondAccount.addr.toString()
      }
    })

    // Should complete without errors
    expect(portfolioTokenId).toBe(1n)
  })

  test('burns portfolio successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint multiple portfolios
    await client.send.mintPortfolio({
      args: { owner: testAccount.addr.toString(), level: 1n, metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh' }
    })
    await client.send.mintPortfolio({
      args: { owner: testAccount.addr.toString(), level: 2n, metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh' }
    })

    // Burn first portfolio
    await client.send.burnPortfolio({
      args: {
        portfolioTokenId: 1n,
        owner: testAccount.addr.toString()
      }
    })

    // Check supply decreased
    const stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![0]).toBe(2n) // Total tokens minted (still 2)
    expect(stats.return![1]).toBe(1n) // Current supply (decreased to 1)
  })

  test('validates portfolio token existence', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Check non-existent token
    const existsResult1 = await client.send.portfolioExists({
      args: { portfolioTokenId: 1n }
    })
    expect(existsResult1.return).toBe(0n) // Should not exist

    // Mint a portfolio
    await client.send.mintPortfolio({
      args: { owner: testAccount.addr.toString(), level: 1n, metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh' }
    })

    // Check existing token 
    const existsResult2 = await client.send.portfolioExists({
      args: { portfolioTokenId: 1n }
    })
    expect(existsResult2.return).toBe(1n) // Should exist
  })

  test('prevents unauthorized operations', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const unauthorizedAccount = await localnet.context.generateAccount({ initialFunds: (1).algo() })

    // Create unauthorized client
    const unauthorizedClient = client.clone({ defaultSender: unauthorizedAccount })

    // These operations should fail with unauthorized account
    await expect(
      unauthorizedClient.send.mintPortfolio({
        args: { owner: unauthorizedAccount.addr.toString(), level: 1n, metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh' }
      })
    ).rejects.toThrow()

    await expect(
      unauthorizedClient.send.setAuthorizedMinter({ args: { newMinter: unauthorizedAccount.addr.toString() } })
    ).rejects.toThrow()
  })

  test('updates authorized minter successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const newMinter = await localnet.context.generateAccount({ initialFunds: (1).algo() })

    // Update authorized minter
    await client.send.setAuthorizedMinter({
      args: { newMinter: newMinter.addr.toString() }
    })

    // Create client with new minter
    const newMinterClient = client.clone({ defaultSender: newMinter })

    // New minter should be able to mint
    const result = await newMinterClient.send.mintPortfolio({
      args: { owner: newMinter.addr.toString(), level: 1n, metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh' }
    })

    expect(result.return).toBe(1n)
  })

  test('handles complex portfolio lifecycle', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const user1 = await localnet.context.generateAccount({ initialFunds: (1).algo() })
    const user2 = await localnet.context.generateAccount({ initialFunds: (1).algo() })

    // 1. Mint portfolios for multiple users
    const portfolio1 = await client.send.mintPortfolio({
      args: { owner: user1.addr.toString(), level: 1n, metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh' }
    })
    const portfolio2 = await client.send.mintPortfolio({
      args: { owner: user2.addr.toString(), level: 2n, metadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh' }
    })

    // 2. Add positions to portfolios
    await client.send.addPositionToPortfolio({
      args: { portfolioTokenId: portfolio1.return!, positionTokenId: 101n, owner: user1.addr.toString() }
    })
    await client.send.addPositionToPortfolio({
      args: { portfolioTokenId: portfolio1.return!, positionTokenId: 102n, owner: user1.addr.toString() }
    })
    await client.send.addPositionToPortfolio({
      args: { portfolioTokenId: portfolio2.return!, positionTokenId: 201n, owner: user2.addr.toString() }
    })

    // 3. Update portfolio values over time
    await client.send.updatePortfolio({
      args: {
        portfolioTokenId: portfolio1.return!,
        newLevel: 3n,
        newMetadataCid: 'QmXg9Pp2ytZ14k4mPqMdsWAPp6jgTzD1XH8eWpLw2j2jLh'
      }
    })

    // 4. Transfer ownership
    await client.send.transferPortfolio({
      args: {
        portfolioTokenId: portfolio1.return!,
        currentOwner: user1.addr.toString(),
        newOwner: user2.addr.toString()
      }
    })

    // 5. Remove position from portfolio
    await client.send.removePositionFromPortfolio({
      args: {
        portfolioTokenId: portfolio1.return!,
        positionTokenId: 102n,
        owner: user2.addr.toString()
      }
    })

    // Verify final state
    const stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![0]).toBe(2n) // 2 portfolios minted
    expect(stats.return![1]).toBe(2n) // 2 still active
    expect(stats.return![4]).toBe(12345n) // Position NFT app ID set

    const portfolio1Exists = await client.send.portfolioExists({
      args: { portfolioTokenId: portfolio1.return! }
    })
    const portfolio2Exists = await client.send.portfolioExists({
      args: { portfolioTokenId: portfolio2.return! }
    })
    
    expect(portfolio1Exists.return).toBe(1n)
    expect(portfolio2Exists.return).toBe(1n)
  })
})