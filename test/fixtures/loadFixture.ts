import { Signer } from '@ethersproject/abstract-signer'
import { Fixture } from 'ethereum-waffle'
import { waffle } from 'hardhat'

const { createFixtureLoader } = waffle

export function loadFixtureAdapter(signers: Signer[]): <T>(fixture: Fixture<T>) => Promise<T> {
  // @ts-ignore
  return createFixtureLoader(Object.values(signers))
}
