import { config as dotEnvConfig } from 'dotenv'
dotEnvConfig()

import { HardhatUserConfig } from 'hardhat/types'

import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-typechain'

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [{ version: '0.6.8', settings: {} }],
  },
  networks: {
    hardhat: {},
    localhost: {},
  },
}

export default config
