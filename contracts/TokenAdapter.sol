// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;

interface TokenAdapter {
    function transfer(address, address, uint) external returns (bool);
    function transferFrom(address, address, address, uint) external returns (bool);
}