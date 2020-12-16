/* SPDX-License-Identifier: MIT */
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./WithWhitelist.sol";
import "../MockToken.sol";

contract MockWhitelistToken is MockToken, WithWhitelist {

  mapping(address => bool) public override isWhitelisted;

  constructor (string memory symbol, uint8 decimals) MockToken(symbol, decimals) {
  }

  function addToWhitelist(address _investor) external {
    isWhitelisted[_investor] = true;
  }

  function removeFromWhitelist(address _investor) external {
    isWhitelisted[_investor] = false;
  }

}
