// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

interface TokenAdapter {
    function transfer(address, address, uint) external returns (bool);
    function transferFrom(address, address, address, uint) external returns (bool);
}
