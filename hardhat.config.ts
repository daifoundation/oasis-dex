import { config as dotEnvConfig } from 'dotenv'
dotEnvConfig()

import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-typechain'
import 'hardhat-watcher'

import { HardhatUserConfig } from 'hardhat/types'

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [{ version: '0.6.8', settings: {} }],
  },
  networks: {
    hardhat: {},
    localhost: {},
  },
  watcher: {
    test: {
      tasks: ['test'],
      files: ['./contracts', './test'],
      verbose: true,
    },
  },
}

export default config
