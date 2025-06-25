import { Config } from '@algorandfoundation/algokit-utils'
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { Address } from 'algosdk'
import * as algosdk from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { CultivestPositionNftFactory } from '../artifacts/position-nft/CultivestPositionNFTClient'

describe('CultivestPositionNFT E2E Tests', () => {
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
  })

  test('mints Bitcoin position NFT successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    const result = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n, // Bitcoin
        holdings: 10000n, // 10,000 sats
        purchaseValueUsd: 100n, // $1.00 in cents
        privateKeyRef: 'bitcoin-key-ref-12345'
      }
    })

    expect(result.return).toBe(1n) // First token ID

    // Verify token exists
    const existsResult = await client.send.tokenExists({ args: { positionTokenId: 1n } })
    expect(existsResult.return).toBe(1n)

    // Check updated stats
    const stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![0]).toBe(1n) // Total tokens minted
    expect(stats.return![1]).toBe(1n) // Current supply
  })

  test('mints multiple different asset types', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint Bitcoin position
    const btcResult = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n, // Bitcoin
        holdings: 50000n, // 50,000 sats
        purchaseValueUsd: 500n, // $5.00
        privateKeyRef: 'btc-key-123'
      }
    })

    // Mint Algorand position
    const algoResult = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 2n, // Algorand
        holdings: 10000000n, // 10 ALGO in microALGO
        purchaseValueUsd: 1000n, // $10.00
        privateKeyRef: 'algo-key-456'
      }
    })

    // Mint USDC position
    const usdcResult = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 3n, // USDC
        holdings: 25000000n, // $25 in microUSDC
        purchaseValueUsd: 2500n, // $25.00
        privateKeyRef: 'usdc-key-789'
      }
    })

    expect(btcResult.return).toBe(1n)
    expect(algoResult.return).toBe(2n)
    expect(usdcResult.return).toBe(3n)

    // Verify all tokens exist
    const btcExists = await client.send.tokenExists({ args: { positionTokenId: 1n } })
    const algoExists = await client.send.tokenExists({ args: { positionTokenId: 2n } })
    const usdcExists = await client.send.tokenExists({ args: { positionTokenId: 3n } })

    expect(btcExists.return).toBe(1n)
    expect(algoExists.return).toBe(1n)
    expect(usdcExists.return).toBe(1n)

    // Check final stats
    const stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![0]).toBe(3n) // Total tokens minted
    expect(stats.return![1]).toBe(3n) // Current supply
  })

  test('updates position values successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint a Bitcoin position
    const mintResult = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'key-123'
      }
    })

    const tokenId = mintResult.return!

    // Update the position with new holdings and value
    await client.send.updatePosition({
      args: {
        positionTokenId: tokenId,
        newHoldings: 15000n, // Increased to 15,000 sats
        newCurrentValueUsd: 150n // Increased to $1.50
      }
    })

    // No direct way to verify the update in this test framework,
    // but the transaction should succeed without throwing
  })

  test('transfers position ownership successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const recipient = await localnet.context.generateAccount({ initialFunds: (1).algo() })

    // Mint a position
    const mintResult = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'transfer-key-123'
      }
    })

    const tokenId = mintResult.return!

    // Transfer the position
    await client.send.transferPosition({
      args: {
        positionTokenId: tokenId,
        currentOwner: testAccount.addr.toString(),
        newOwner: recipient.addr.toString(),
        privateKeyRef: 'transfer-key-123'
      }
    })

    // Transaction should succeed without throwing
  })

  test('assigns position to portfolio successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint a position
    const mintResult = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'portfolio-key-123'
      }
    })

    const tokenId = mintResult.return!

    // Assign to a portfolio (portfolio token ID 100)
    await client.send.assignToPortfolio({
      args: {
        positionTokenId: tokenId,
        portfolioTokenId: 100n,
        owner: testAccount.addr.toString()
      }
    })

    // Transaction should succeed without throwing
  })

  test('burns position successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint two positions
    const mint1 = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'burn-key-1'
      }
    })

    const mint2 = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 2n,
        holdings: 5000000n,
        purchaseValueUsd: 500n,
        privateKeyRef: 'burn-key-2'
      }
    })

    // Check initial supply
    let stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![1]).toBe(2n) // Current supply

    // Burn first position
    await client.send.burnPosition({
      args: {
        positionTokenId: mint1.return!,
        owner: testAccount.addr.toString(),
        privateKeyRef: 'burn-key-1'
      }
    })

    // Check supply after burn
    stats = await client.send.getContractStats({ args: {} })
    expect(stats.return![1]).toBe(1n) // Supply should decrease

    // Second token should still exist
    const exists = await client.send.tokenExists({ args: { positionTokenId: mint2.return! } })
    expect(exists.return).toBe(1n)
  })

  test('updates authorized minter successfully', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const newMinter = await localnet.context.generateAccount({ initialFunds: (1).algo() })

    // Fund the new minter account
    await localnet.algorand.send.payment({
      sender: testAccount.addr.toString(),
      receiver: newMinter.addr.toString(),
      amount: (1).algo()
    })

    // Update authorized minter
    await client.send.setAuthorizedMinter({
      args: { newMinter: newMinter.addr.toString() }
    })

    // Original account should no longer be able to mint
    await expect(client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'unauthorized-key'
      }
    })).rejects.toThrow()

    // New minter should be able to mint
    const newMinterClient = client.clone({ defaultSender: newMinter })
    const result = await newMinterClient.send.mintPosition({
      args: {
        owner: newMinter.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'new-minter-key'
      }
    })

    expect(result.return).toBe(1n)
  })

  test('rejects invalid asset types', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Test invalid asset type 0
    await expect(client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 0n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'invalid-key'
      }
    })).rejects.toThrow()

    // Test invalid asset type 4
    await expect(client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 4n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'invalid-key'
      }
    })).rejects.toThrow()
  })

  test('rejects zero values', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Test zero holdings
    await expect(client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 0n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'zero-holdings-key'
      }
    })).rejects.toThrow()

    // Test zero purchase value
    await expect(client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 0n,
        privateKeyRef: 'zero-value-key'
      }
    })).rejects.toThrow()
  })

  test('handles transaction groups correctly', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Test transaction group with multiple mints
    const result = await client
      .newGroup()
      .mintPosition({
        args: {
          owner: testAccount.addr.toString(),
          assetType: 1n,
          holdings: 10000n,
          purchaseValueUsd: 100n,
          privateKeyRef: 'group-key-1'
        }
      })
      .mintPosition({
        args: {
          owner: testAccount.addr.toString(),
          assetType: 2n,
          holdings: 5000000n,
          purchaseValueUsd: 500n,
          privateKeyRef: 'group-key-2'
        }
      })
      .send()

    expect(result.returns[0]).toBe(1n)
    expect(result.returns[1]).toBe(2n)

    // Verify both tokens exist
    const exists1 = await client.send.tokenExists({ args: { positionTokenId: 1n } })
    const exists2 = await client.send.tokenExists({ args: { positionTokenId: 2n } })

    expect(exists1.return).toBe(1n)
    expect(exists2.return).toBe(1n)
  })

  test('verifies event logging through transaction logs', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Mint a position and check that logs are generated
    const result = await client.send.mintPosition({
      args: {
        owner: testAccount.addr.toString(),
        assetType: 1n,
        holdings: 10000n,
        purchaseValueUsd: 100n,
        privateKeyRef: 'log-test-key'
      }
    })

    // The transaction result should have logs
    expect(result.confirmation.logs).toBeDefined()
    expect(result.confirmation.logs!.length).toBeGreaterThan(0)

    // Decode and verify the logged values
    const logs = result.confirmation.logs!.map((log: Uint8Array) => Buffer.from(log))
    
    // Find and verify position_minted log
    const mintedLog = logs.find(log => log.toString().startsWith('position_minted:'))
    expect(mintedLog).toBeDefined()
    const tokenIdBytes = mintedLog!.slice('position_minted:'.length)
    const loggedTokenId = tokenIdBytes.readBigUInt64BE(0)
    expect(loggedTokenId).toBe(1n)
    
    // Find and verify position_asset_type log
    const assetTypeLog = logs.find(log => log.toString().startsWith('position_asset_type:'))
    expect(assetTypeLog).toBeDefined()
    const assetTypeBytes = assetTypeLog!.slice('position_asset_type:'.length)
    const loggedAssetType = assetTypeBytes.readBigUInt64BE(0)
    expect(loggedAssetType).toBe(1n) // Bitcoin
    
    // Find and verify position_holdings log
    const holdingsLog = logs.find(log => log.toString().startsWith('position_holdings:'))
    expect(holdingsLog).toBeDefined()
    const holdingsBytes = holdingsLog!.slice('position_holdings:'.length)
    const loggedHoldings = holdingsBytes.readBigUInt64BE(0)
    expect(loggedHoldings).toBe(10000n)
    
    // Find and verify position_purchase_value log
    const valueLog = logs.find(log => log.toString().startsWith('position_purchase_value:'))
    expect(valueLog).toBeDefined()
    const valueBytes = valueLog!.slice('position_purchase_value:'.length)
    const loggedValue = valueBytes.readBigUInt64BE(0)
    expect(loggedValue).toBe(100n)
    
    // Find and verify position_key_ref log (this one is a string)
    const keyRefLog = logs.find(log => log.toString().startsWith('position_key_ref:'))
    expect(keyRefLog).toBeDefined()
    const keyRefString = keyRefLog!.slice('position_key_ref:'.length).toString()
    expect(keyRefString).toBe('log-test-key')
    
    // Find and verify position_owner log
    const ownerLog = logs.find(log => log.toString().startsWith('position_owner:'))
    expect(ownerLog).toBeDefined()
    const ownerBytes = ownerLog!.slice('position_owner:'.length)
    expect(ownerBytes.length).toBe(32) // Algorand addresses are 32 bytes

    // Convert raw address bytes to proper Algorand address format
    const loggedOwnerAddress = algosdk.encodeAddress(new Uint8Array(ownerBytes))
    console.log('loggedOwnerAddress: ', loggedOwnerAddress)
    expect(loggedOwnerAddress).toBe(testAccount.addr.toString())
  })
})