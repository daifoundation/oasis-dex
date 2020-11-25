import { Signer } from '@ethersproject/abstract-signer'

import { MockToken, OasisTester } from '../../typechain'
import { OasisBase } from '../../typechain/OasisBase'
import { OasisCustomerBase } from '../exchange/oasisCustomer'
import { dai, mkr } from "../utils/units"

export const INITIAL_MKR_BALANCE = mkr('10000')
export const INITIAL_DAI_BALANCE = dai('10000')

export interface OasisFixture {
    makerSigner: Signer;
    makerAddress: string;
    takerSigner: Signer;
    takerAddress: string;
    baseToken: MockToken;
    quoteToken: MockToken;
    oasis: OasisBase;
    maker: OasisTester;
    taker: OasisTester;
    alice: OasisCustomerBase;
    bob: OasisCustomerBase;
}
