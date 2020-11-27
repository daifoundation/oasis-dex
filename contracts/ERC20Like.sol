// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;

interface ERC20Like {
    function transfer(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
    function decimals() external view returns (uint8);
}
