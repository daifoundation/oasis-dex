/* SPDX-License-Identifier: MIT */
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {

    constructor (string memory symbol, uint8 decimals) ERC20(symbol, symbol) {
        _setupDecimals(decimals);
        _mint(msg.sender, 1_000_000 * 10 ** uint256(decimals));
    }
}
