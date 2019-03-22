pragma solidity ^0.5.4;

// function getOffers(OtcInterface otc, address payToken, address buyToken) public view
//     returns (
//         uint[100] ids,
//         uint[100] payAmts,
//         uint[100] buyAmts,
//         address[100] owners,
//         uint[100] timestamps
//     )
// {
//     (ids, payAmts, buyAmts, owners, timestamps) =
//         getOffers(otc, otc.getBestOffer(payToken, buyToken));
// }

// function getOffers(OtcInterface otc, uint offerId) public view
//     returns (
//         uint[100] ids,
//         uint[100] payAmts,
//         uint[100] buyAmts,
//         address[100] owners,
//         uint[100] timestamps
//     )
// {
//     uint i = 0;
//     do {
//         (payAmts[i],, buyAmts[i],, owners[i], timestamps[i]) = otc.offers(offerId);
//         if(owners[i] == 0) break;
//         ids[i] = offerId;
//         offerId = otc.getWorseOffer(offerId);
//     } while (++i < 100);
// }