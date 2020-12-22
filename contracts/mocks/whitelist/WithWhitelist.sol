// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

interface WithWhitelist {
    function isWhitelisted(address) external view returns (bool);
}
