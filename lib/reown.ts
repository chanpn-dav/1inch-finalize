import { createAppKit } from '@reown/appkit'
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5'
import { mainnet } from '@reown/appkit/networks'

// Project configuration
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id-here'
console.log('🔧 Reown Project ID:', projectId)

// Metadata for wallet connection
const metadata = {
  name: 'Wallet Connection',
  description: 'Connect your wallet securely',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://example.com',
  icons: ['https://example.com/favicon.ico']
}

// Create the Ethers adapter
const ethersAdapter = new Ethers5Adapter()

// Suppress Lit development warnings
if (typeof window !== 'undefined') {
  (window as any).litDevMode = false
  const originalWarn = console.warn
  console.warn = (...args) => {
    const message = args.join(' ')
    if (message.includes('scheduled an update') || 
        message.includes('change-in-update') ||
        message.includes('Lit is in dev mode') ||
        message.includes('reactive-element')) {
      return
    }
    originalWarn.apply(console, args)
  }
}

// Initialize Reown AppKit
let appKit: any = null
try {
  appKit = createAppKit({
    adapters: [ethersAdapter],
    networks: [mainnet],
    metadata,
    projectId,
    features: {
      analytics: false,
      email: false,
      socials: [],
      onramp: false,
      swaps: false,
      history: false
    },
    themeMode: 'light',
    themeVariables: {
      '--w3m-accent': '#378ef5',
      '--w3m-border-radius-master': '12px',
      '--w3m-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      '--w3m-z-index': '99999'
    } as any,
    enableWalletConnect: true,
    enableInjected: true,
    enableEIP6963: true,
    enableCoinbase: true,
    allWallets: 'SHOW',
    featuredWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
      '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
      'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18', // Zerion
      '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709'  // OKX Wallet
    ]
  })
  console.log('✅ Reown AppKit initialized')
} catch (error) {
  console.error('❌ Reown AppKit initialization failed:', error)
}

export { appKit }

export class ReownWalletManager {
  private modal: any = null
  private isConnectedState: boolean = false
  private accountState: string | undefined = undefined
  private chainIdState: number | undefined = undefined

  constructor() {
    this.modal = appKit
    if (this.modal) {
      this.initializeListeners()
      console.log('✅ Reown wallet manager initialized')
    } else {
      console.error('❌ Reown unavailable')
    }
  }

  private initializeListeners() {
    if (!this.modal) return

    let accountChangeTimeout: NodeJS.Timeout | null = null

    this.modal.subscribeAccount?.((account: any) => {
      if (accountChangeTimeout) clearTimeout(accountChangeTimeout)
      accountChangeTimeout = setTimeout(() => {
        const newAddress = account?.address
        const newConnected = account?.isConnected || false
        if (newAddress !== this.accountState || newConnected !== this.isConnectedState) {
          this.accountState = newAddress
          this.isConnectedState = newConnected
          console.log(newAddress ? `🔗 Account connected: ${newAddress}` : '🔌 Account disconnected')
        }
      }, 100)
    })

    this.modal.subscribeChainId?.((chainId: number) => {
      if (chainId !== this.chainIdState) {
        this.chainIdState = chainId
        console.log('🌐 Network changed:', chainId)
      }
    })

    this.modal.subscribeEvents?.((event: any) => {
      console.log('📱 Reown Event:', event.type || event.data?.event, event)
      if (event.data?.event === 'SELECT_WALLET' || event.type === 'SELECT_WALLET') {
        const walletInfo = event.data?.properties || event.properties || {}
        const walletId = walletInfo.name || walletInfo.id || walletInfo.walletId || 'unknown'
        console.log(`📱 Wallet selected: ${walletId}`)
        const { isIOS, isAndroid } = this.detectMobileWalletEnvironment()
        this.openSpecificWallet(walletId, isIOS, isAndroid)
      }
    })
  }

  async connect(): Promise<string> {
    try {
      if (!appKit) throw new Error('Reown AppKit not initialized')

      const { isMobile, isIOS, isAndroid, isWalletBrowser, walletName } = this.detectMobileWalletEnvironment()
      console.log(`📱 Environment: Mobile=${isMobile}, iOS=${isIOS}, Android=${isAndroid}, WalletBrowser=${isWalletBrowser}, Wallet=${walletName || 'None'}`)

      this.optimizeMobileViewport()

      if (isWalletBrowser && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          if (accounts?.length > 0) {
            console.log(`✅ Direct connection to ${walletName}: ${accounts[0]}`)
            this.accountState = accounts[0]
            this.isConnectedState = true
            return accounts[0]
          }
        } catch (error) {
          console.error(`📱 Direct ${walletName} connection failed:`, error)
        }
      }

      console.log('📱 Opening Reown modal...')
      await this.modal.open()
      this.enhanceReownModalForMobile()

      return new Promise((resolve, reject) => {
        const maxAttempts = isMobile ? 30 : 5
        const checkInterval = isMobile ? 1000 : 200
        const timeout = isIOS ? 120000 : isAndroid ? (walletName === 'Trust Wallet' ? 150000 : 100000) : 30000
        let connectionAttempts = 0

        const cleanupBridge = isMobile ? this.createMobileWalletBridge(isMobile, isIOS, isAndroid) : () => {}

        const checkConnection = () => {
          if (this.isConnectedState && this.accountState) {
            console.log(`✅ Connected: ${this.accountState}`)
            cleanupBridge()
            resolve(this.accountState)
          } else {
            connectionAttempts++
            if (connectionAttempts < maxAttempts) {
              console.log(`📱 Connection check ${connectionAttempts}/${maxAttempts}`)
              setTimeout(checkConnection, checkInterval)
            } else {
              console.log('⏰ Final connection check...')
              setTimeout(() => {
                if (this.isConnectedState && this.accountState) {
                  cleanupBridge()
                  resolve(this.accountState)
                } else {
                  cleanupBridge()
                  reject(new Error('Connection timeout - Please select a wallet and approve in the app'))
                }
              }, 3000)
            }
          }
        }

        setTimeout(checkConnection, 1000)

        setTimeout(() => {
          if (!this.isConnectedState) {
            cleanupBridge()
            reject(new Error(`Connection timeout after ${timeout/1000}s`))
          }
        }, timeout)
      })
    } catch (error) {
      console.error('❌ Connection failed:', error)
      throw error
    }
  }

  disconnect(): void {
    try {
      this.modal?.disconnect?.()
      this.isConnectedState = false
      this.accountState = undefined
      this.chainIdState = undefined
      console.log('🔌 Wallet disconnected')
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  private createMobileWalletBridge(isMobile: boolean, isIOS: boolean, isAndroid: boolean) {
    if (!isMobile) return () => {}

    console.log('📱 Creating mobile wallet bridge...')
    let hasLeftPage = false
    let connectionTimeout: NodeJS.Timeout | null = null

    const handleVisibilityChange = () => {
      console.log(`📱 Visibility changed: document.hidden = ${document.hidden}`)
      if (document.hidden && !hasLeftPage) {
        hasLeftPage = true
        console.log('📱 User switched to wallet app')
        connectionTimeout = setTimeout(() => {
          if (!this.isConnected()) {
            console.log('📱 Wallet connection timeout')
          }
        }, isIOS ? 120000 : 100000)
      } else if (!document.hidden && hasLeftPage) {
        console.log('📱 User returned from wallet app')
        if (connectionTimeout) clearTimeout(connectionTimeout)
        setTimeout(() => {
          if (this.isConnected()) {
            console.log('✅ Wallet connected after app switch')
            document.body.style.overflow = ''
            document.body.style.position = ''
            document.body.style.width = ''
            document.body.style.height = ''
          } else {
            console.log('📱 No connection yet, waiting...')
          }
        }, 2000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleFocus = () => {
      if (hasLeftPage) {
        console.log('📱 Page gained focus')
        setTimeout(() => {
          if (this.isConnected()) {
            console.log('✅ Wallet connected on focus')
          }
        }, 1000)
      }
    }

    window.addEventListener('focus', handleFocus)

    const cleanup = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      if (connectionTimeout) clearTimeout(connectionTimeout)
      console.log('📱 Mobile wallet bridge cleaned up')
    }

    setTimeout(cleanup, 120000)
    return cleanup
  }

  private getAppStoreLink(walletName: string): string {
    const appStoreLinks: Record<string, string> = {
      'MetaMask': 'https://apps.apple.com/app/metamask/id1438144202',
      'Trust Wallet': 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
      'Rainbow': 'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021',
      'Coinbase Wallet': 'https://apps.apple.com/app/coinbase-wallet/id1278383455',
      'Zerion': 'https://apps.apple.com/app/zerion-wallet-defi-nfts/id1456732565',
      'imToken': 'https://apps.apple.com/app/imtoken2/id1384798940',
      'TokenPocket': 'https://apps.apple.com/app/tokenpocket/id1436028697',
      'SafePal': 'https://apps.apple.com/app/safepal-wallet/id1548297139',
      'Bitget': 'https://apps.apple.com/app/bitget-wallet/id1436542674',
      'OKX Wallet': 'https://apps.apple.com/app/okx-wallet/id1327268470'
    }
    return appStoreLinks[walletName] || 'https://apps.apple.com/app/metamask/id1438144202'
  }

  private getPlayStoreLink(walletName: string): string {
    const playStoreLinks: Record<string, string> = {
      'MetaMask': 'https://play.google.com/store/apps/details?id=io.metamask',
      'Trust Wallet': 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
      'Rainbow': 'https://play.google.com/store/apps/details?id=me.rainbow',
      'Coinbase Wallet': 'https://play.google.com/store/apps/details?id=org.toshi',
      'Zerion': 'https://play.google.com/store/apps/details?id=io.zerion.android',
      'imToken': 'https://play.google.com/store/apps/details?id=im.token.app',
      'TokenPocket': 'https://play.google.com/store/apps/details?id=com.tokenpocket.gp',
      'SafePal': 'https://play.google.com/store/apps/details?id=io.safepal.wallet',
      'Bitget': 'https://play.google.com/store/apps/details?id=com.bitkeep.wallet',
      'OKX Wallet': 'https://play.google.com/store/apps/details?id=com.okinc.okex.gp'
    }
    return playStoreLinks[walletName] || 'https://play.google.com/store/apps/details?id=io.metamask'
  }

  private getAndroidPackage(walletName: string): string {
    const packages: Record<string, string> = {
      'MetaMask': 'io.metamask',
      'Trust Wallet': 'com.wallet.crypto.trustapp',
      'Rainbow': 'me.rainbow',
      'Coinbase Wallet': 'org.toshi',
      'Zerion': 'io.zerion.android',
      'imToken': 'im.token.app',
      'TokenPocket': 'com.tokenpocket.gp',
      'SafePal': 'io.safepal.wallet',
      'Bitget': 'com.bitkeep.wallet',
      'OKX Wallet': 'com.okinc.okex.gp'
    }
    return packages[walletName] || 'io.metamask'
  }

  private getIOSScheme(walletName: string): string {
    const universalLinks: Record<string, string> = {
      'MetaMask': 'https://metamask.app.link/wc',
      'Trust Wallet': 'https://link.trustwallet.com/wc',
      'Rainbow': 'https://rnbwapp.com/wc',
      'Coinbase Wallet': 'https://www.coinbase.com/wallet/wc',
      'Zerion': 'https://zerion.app.link/wc',
      'imToken': 'imtokenv2://wc',
      'TokenPocket': 'tpoutside://wc',
      'SafePal': 'safepalwallet://wc',
      'Bitget': 'bitkeep://wc',
      'OKX Wallet': 'okx://wc'
    }
    return universalLinks[walletName] || 'https://metamask.app.link/wc'
  }

  private openSpecificWallet(walletId: string, isIOS: boolean, isAndroid: boolean) {
    const walletMapping: Record<string, string> = {
      'metamask': 'MetaMask',
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96': 'MetaMask',
      'trust': 'Trust Wallet',
      'trustwallet': 'Trust Wallet',
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0': 'Trust Wallet',
      'rainbow': 'Rainbow',
      '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369': 'Rainbow',
      'coinbase': 'Coinbase Wallet',
      'coinbasewallet': 'Coinbase Wallet',
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa': 'Coinbase Wallet',
      'zerion': 'Zerion',
      'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18': 'Zerion',
      'imtoken': 'imToken',
      'tokenpocket': 'TokenPocket',
      'safepal': 'SafePal',
      'bitget': 'Bitget',
      'okx': 'OKX Wallet',
      '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709': 'OKX Wallet',
      'walletconnect': 'WalletConnect'
    }

    const normalizedId = walletId.toLowerCase().replace(/[\s-_]/g, '')
    let walletName = walletMapping[walletId] || walletMapping[normalizedId] || 'MetaMask'
    console.log(`📱 Mapped "${walletId}" to "${walletName}"`)

    try {
      let wcUri = ''
      try {
        if (this.modal?.getWalletConnectUri) {
          wcUri = this.modal.getWalletConnectUri() || ''
          console.log(`📱 WC URI: ${wcUri}`)
        }
      } catch (error) {
        console.warn('📱 Failed to get WC URI:', error)
      }

      if (isIOS) {
        const deepLinkUrl = wcUri ? `${this.getIOSScheme(walletName)}?uri=${encodeURIComponent(wcUri)}` : this.getIOSScheme(walletName)
        try {
          window.location.href = deepLinkUrl
          console.log(`📱 iOS: Attempting deep link: ${deepLinkUrl}`)
        } catch (error) {
          console.error(`📱 iOS deep link failed: ${error}`)
          window.location.href = this.getAppStoreLink(walletName)
          console.log(`📱 iOS: Fallback to App Store for ${walletName}`)
        }
      } else if (isAndroid) {
        const packageName = this.getAndroidPackage(walletName)
        const scheme = this.getIOSScheme(walletName).includes('http') ? 'wc' : this.getIOSScheme(walletName).split('://')[0]
        const intentUrl = wcUri 
          ? `intent://wc?uri=${encodeURIComponent(wcUri)}#Intent;scheme=${scheme};package=${packageName};end;`
          : `intent://wc#Intent;scheme=${scheme};package=${packageName};end;`
        try {
          window.location.href = intentUrl
          console.log(`📱 Android: Attempting intent: ${intentUrl}`)
        } catch (error) {
          console.error(`📱 Android intent failed: ${error}`)
          window.location.href = this.getPlayStoreLink(walletName)
          console.log(`📱 Android: Fallback to Play Store for ${walletName}`)
        }
      }
    } catch (error) {
      console.error(`📱 Failed to open ${walletName}:`, error)
    }
  }

  private detectMobileWalletEnvironment(): { 
    isMobile: boolean; 
    isIOS: boolean; 
    isAndroid: boolean; 
    isWalletBrowser: boolean;
    walletName?: string;
  } {
    if (typeof window === 'undefined') {
      return { isMobile: false, isIOS: false, isAndroid: false, isWalletBrowser: false }
    }

    const userAgent = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/i.test(userAgent)
    const isAndroid = /android/i.test(userAgent)
    const isMobile = isIOS || isAndroid
    let isWalletBrowser = false
    let walletName: string | undefined

    if (userAgent.includes('trust') || userAgent.includes('trustwallet')) {
      isWalletBrowser = true
      walletName = 'Trust Wallet'
    } else if (userAgent.includes('metamask') || userAgent.includes('metamaskmobile')) {
      isWalletBrowser = true
      walletName = 'MetaMask'
    } else if (userAgent.includes('coinbase') || userAgent.includes('cbwallet')) {
      isWalletBrowser = true
      walletName = 'Coinbase Wallet'
    } else if (userAgent.includes('imtoken')) {
      isWalletBrowser = true
      walletName = 'imToken'
    } else if (userAgent.includes('tokenpocket')) {
      isWalletBrowser = true
      walletName = 'TokenPocket'
    } else if (userAgent.includes('safepal')) {
      isWalletBrowser = true
      walletName = 'SafePal'
    } else if (userAgent.includes('bitget') || userAgent.includes('bitkeep')) {
      isWalletBrowser = true
      walletName = 'Bitget'
    } else if (userAgent.includes('okapp') || userAgent.includes('okx')) {
      isWalletBrowser = true
      walletName = 'OKX Wallet'
    }

    if (window.ethereum) {
      if (window.ethereum.isMetaMask) walletName = 'MetaMask'
      else if (window.ethereum.isCoinbaseWallet) walletName = 'Coinbase Wallet'
      else if (window.ethereum.isTrust) walletName = 'Trust Wallet'
      isWalletBrowser = true
    }

    return { isMobile, isIOS, isAndroid, isWalletBrowser, walletName }
  }

  getAccount(): string | undefined {
    return this.accountState || this.modal?.getAccount?.()?.address
  }

  getChainId(): number | undefined {
    if (this.chainIdState) return this.chainIdState
    try {
      return this.modal?.getChainId?.() || this.modal?.state?.chainId
    } catch (error) {
      console.warn('Failed to get chain ID:', error)
      return undefined
    }
  }

  isConnected(): boolean {
    return this.isConnectedState || this.modal?.getAccount?.()?.isConnected || false
  }

  async getProvider(): Promise<any> {
    try {
      if (appKit && this.modal) {
        const provider = await this.modal.getWalletProvider?.()
        if (provider) return provider
      }
      if (window.ethereum) {
        console.log('🔄 Using window.ethereum provider')
        return window.ethereum
      }
      throw new Error('No provider available')
    } catch (error) {
      console.warn('⚠️ Provider access failed:', error)
      return window.ethereum || null
    }
  }

  subscribeToAccount(callback: (account: string | undefined) => void): () => void {
    return this.modal.subscribeAccount?.((account: any) => {
      this.accountState = account?.address
      this.isConnectedState = account?.isConnected || false
      callback(this.accountState)
    }) || (() => {})
  }

  subscribeToNetwork(callback: (chainId: number | undefined) => void): () => void {
    return this.modal.subscribeChainId?.((chainId: number) => {
      this.chainIdState = chainId
      callback(chainId)
    }) || (() => {})
  }

  private optimizeMobileViewport() {
    if (typeof window === 'undefined') return
    console.log('📱 Setting mobile viewport')
    let viewport = document.querySelector('meta[name="viewport"]')
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
    } else {
      viewport = document.createElement('meta')
      viewport.setAttribute('name', 'viewport')
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
      document.head.appendChild(viewport)
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.height = '100%'
  }

  private optimizeMobileModal() {
    if (typeof window === 'undefined') return
    console.log('📱 Optimizing Reown modal...')
    setTimeout(() => {
      const modal = document.querySelector('w3m-modal, [data-testid="w3m-modal"], .w3m-container')
      if (modal) {
        console.log(`📱 Found modal: ${modal.tagName}`)
        const modalElement = modal as HTMLElement
        modalElement.style.position = 'fixed'
        modalElement.style.top = '0'
        modalElement.style.left = '0'
        modalElement.style.width = '100vw'
        modalElement.style.height = '100vh'
        modalElement.style.zIndex = '999999'
        const modalContent = modal.querySelector('[role="dialog"], .modal-content, .w3m-modal-content')
        if (modalContent) {
          const contentElement = modalContent as HTMLElement
          contentElement.style.maxHeight = '90vh'
          contentElement.style.overflowY = 'auto'
          contentElement.style.padding = '20px'
        }
      } else {
        console.error('📱 Modal not found')
      }
    }, 2000)
  }

  private enhanceReownModalForMobile() {
    if (typeof window === 'undefined') return
    console.log('📱 Enhancing Reown modal...')
    const style = document.createElement('style')
    style.textContent = `
      w3m-modal, [data-testid="w3m-modal"], .w3m-container {
        --w3m-z-index: 999999 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
      }
      w3m-wallet-button, [data-testid*="wallet"] {
        min-height: 60px !important;
        padding: 12px !important;
        margin: 8px 0 !important;
        touch-action: manipulation !important;
      }
      @media (max-width: 768px) {
        w3m-modal, .w3m-container {
          background: #fff;
        }
        [data-testid="wallet-selector"], .w3m-wallet-grid {
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
          gap: 16px !important;
          padding: 20px !important;
        }
        [data-testid*="wallet-button"], w3m-wallet-button {
          width: 100% !important;
          justify-content: flex-start !important;
          text-align: left !important;
        }
      }
    `
    document.head.appendChild(style)
    this.addMobileWalletInteractionListeners()
  }

  private addMobileWalletInteractionListeners() {
    console.log('📱 Adding mobile wallet listeners...')
    const checkForWalletButtons = () => {
      const walletButtons = document.querySelectorAll('w3m-wallet-button, [data-testid*="wallet"], [data-wallet-id], button[class*="wallet"]')
      walletButtons.forEach((button) => {
        if (!button.getAttribute('data-mobile-enhanced')) {
          button.setAttribute('data-mobile-enhanced', 'true')
          button.addEventListener('touchstart', () => {
            button.classList.add('mobile-touch-active')
          }, { passive: true })
          button.addEventListener('touchend', () => {
            setTimeout(() => button.classList.remove('mobile-touch-active'), 150)
          }, { passive: true })
          button.addEventListener('click', () => {
            const walletName = button.textContent?.trim() || button.getAttribute('data-wallet-id') || 'Unknown Wallet'
            console.log(`📱 Wallet selected: ${walletName}`)
          })
        }
      })
    }
    checkForWalletButtons()
    const intervalId = setInterval(checkForWalletButtons, 1000)
    setTimeout(() => clearInterval(intervalId), 30000)
  }
}

export const reownWalletManager = new ReownWalletManager()

export const SUPPORTED_WALLETS = [
  'MetaMask',
  'Coinbase Wallet',
  'Brave Wallet',
  'Phantom',
  'Rabby Wallet',
  'Frame',
  'Trust Wallet',
  'Rainbow',
  'Uniswap Wallet',
  'Zerion',
  'imToken',
  'TokenPocket',
  'SafePal',
  'Bitget',
  'OKX Wallet',
  'Atomic Wallet',
  'Exodus',
  'Crypto.com DeFi Wallet',
  'Ledger',
  'Trezor',
  'WalletConnect'
]

export const PlatformDetector = {
  isIOS: () => typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent),
  isAndroid: () => typeof window !== 'undefined' && /Android/i.test(navigator.userAgent),
  isMobile: () => typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isDesktop: () => typeof window !== 'undefined' && !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isWalletBrowser: () => {
    if (typeof window === 'undefined') return false
    const userAgent = navigator.userAgent.toLowerCase()
    return userAgent.includes('trust') || userAgent.includes('metamask') || userAgent.includes('coinbase') || 
           userAgent.includes('imtoken') || userAgent.includes('tokenpocket') || userAgent.includes('safepal') ||
           userAgent.includes('bitget') || userAgent.includes('okapp')
  }
}