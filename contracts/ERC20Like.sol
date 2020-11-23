// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;

abstract contract ERC20Like {
    function transfer(address, uint) external virtual returns (bool);
    function transferFrom(address, address, uint) external virtual returns (bool);
    function decimals() external virtual returns (uint8);
}