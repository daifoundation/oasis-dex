// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

// Not tested, audited, just a research project! Should not be deployed!

interface TokenAdapter {
    function transfer(address, address, uint) external returns (bool);
    function transferFrom(address, address, address, uint) external returns (bool);
}
