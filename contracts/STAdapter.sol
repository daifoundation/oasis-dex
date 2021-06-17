// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

import "./TokenAdapter.sol";

// Not tested, audited, just a research project! Should not be deployed!

interface STAdapter is TokenAdapter {
    function isWhitelisted(address, address) external view returns (bool);
}
