// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

import "./TokenAdapter.sol";

interface STAdapter is TokenAdapter {
    function isWhitelisted(address, address) external view returns (bool);
}
