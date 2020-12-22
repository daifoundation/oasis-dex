// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

interface ERC20Like {
    function transfer(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);
    function decimals() external view returns (uint8);
}
