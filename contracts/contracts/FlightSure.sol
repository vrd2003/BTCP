// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract FlightSure is Ownable, ReentrancyGuard, Pausable {
    struct Tier {
        uint32 minimumDelayMinutes;
        uint128 amountWei;
    }

    struct Policy {
        address passenger;
        bytes32 flightKey;
        uint64 scheduledArrival;
        uint64 coverageStartsAt;
        uint64 coverageEndsAt;
        uint32 coverageThresholdMinutes;
        uint128 maximumPayoutWei;
        uint128 premiumWei;
        bool paid;
        bool settled;
        Tier[] tiers;
    }

    struct VerifiedArrival {
        uint64 scheduledArrival;
        uint64 actualArrival;
        uint32 delayMinutes;
        uint8 agreeingSources;
        bytes32 evidenceHash;
        bool exists;
    }

    mapping(uint256 => Policy) private policies;
    mapping(bytes32 => VerifiedArrival) public verifiedArrivals;
    mapping(bytes32 => uint256) public activePoliciesByFlight;
    mapping(address => bool) public authorizedOracles;
    uint256 public nextPolicyId = 1;

    event OracleAuthorizationChanged(address indexed oracle, bool authorized);
    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed passenger,
        bytes32 indexed flightKey,
        uint256 premiumWei,
        uint64 scheduledArrival,
        bytes32 termsHash
    );
    event PoolFunded(address indexed funder, uint256 amountWei);
    event PolicySettled(uint256 indexed policyId, uint32 delayMinutes);
    event ArrivalVerified(
        bytes32 indexed flightKey,
        uint32 delayMinutes,
        uint8 agreeingSources,
        bytes32 evidenceHash
    );
    event CompensationPaid(
        uint256 indexed policyId,
        address indexed passenger,
        uint256 amountWei,
        uint32 delayMinutes
    );

    error InvalidPolicyTerms();
    error InvalidOracleEvidence();
    error PolicyUnavailable();
    error DelayNotEligible();
    error TransferFailed();
    error InsufficientPoolBalance();

    modifier onlyOracle() {
        if (!authorizedOracles[msg.sender]) revert InvalidOracleEvidence();
        _;
    }

    constructor() Ownable(msg.sender) {}

    function fundPool() external payable onlyOwner whenNotPaused {
        if (msg.value == 0) revert InvalidPolicyTerms();
        emit PoolFunded(msg.sender, msg.value);
    }

    function setOracle(address oracle, bool authorized) external onlyOwner {
        if (oracle == address(0)) revert InvalidOracleEvidence();
        authorizedOracles[oracle] = authorized;
        emit OracleAuthorizationChanged(oracle, authorized);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function purchasePolicy(
        bytes32 flightKey,
        uint64 scheduledArrival,
        uint64 coverageStartsAt,
        uint64 coverageEndsAt,
        uint32 coverageThresholdMinutes,
        uint128 maximumPayoutWei,
        uint32[] calldata tierDelayMinutes,
        uint128[] calldata tierAmountsWei
    ) external payable whenNotPaused returns (uint256 policyId) {
        uint256 tierCount = tierDelayMinutes.length;
        if (
            flightKey == bytes32(0) ||
            scheduledArrival == 0 ||
            block.timestamp >= scheduledArrival ||
            coverageStartsAt >= scheduledArrival ||
            coverageEndsAt < scheduledArrival ||
            coverageThresholdMinutes == 0 ||
            maximumPayoutWei == 0 ||
            msg.value == 0 ||
            msg.value > type(uint128).max ||
            tierCount == 0 ||
            tierCount != tierAmountsWei.length
        ) revert InvalidPolicyTerms();

        uint32 previousDelay;
        bool hasThresholdTier;
        for (uint256 i; i < tierCount; ++i) {
            uint32 delay = tierDelayMinutes[i];
            uint128 amount = tierAmountsWei[i];
            if (
                (i > 0 && delay <= previousDelay) ||
                delay < coverageThresholdMinutes ||
                amount == 0 ||
                amount > maximumPayoutWei
            ) revert InvalidPolicyTerms();
            if (delay == coverageThresholdMinutes) hasThresholdTier = true;
            previousDelay = delay;
        }
        if (!hasThresholdTier) revert InvalidPolicyTerms();

        policyId = nextPolicyId++;
        Policy storage policy = policies[policyId];
        policy.passenger = msg.sender;
        policy.flightKey = flightKey;
        policy.scheduledArrival = scheduledArrival;
        policy.coverageStartsAt = coverageStartsAt;
        policy.coverageEndsAt = coverageEndsAt;
        policy.coverageThresholdMinutes = coverageThresholdMinutes;
        policy.maximumPayoutWei = maximumPayoutWei;
        policy.premiumWei = uint128(msg.value);
        for (uint256 i; i < tierCount; ++i) {
            policy.tiers.push(Tier(tierDelayMinutes[i], tierAmountsWei[i]));
        }
        activePoliciesByFlight[flightKey] += 1;

        bytes32 termsHash = keccak256(abi.encode(
            coverageStartsAt,
            coverageEndsAt,
            coverageThresholdMinutes,
            maximumPayoutWei,
            tierDelayMinutes,
            tierAmountsWei
        ));
        emit PolicyPurchased(policyId, msg.sender, flightKey, msg.value, scheduledArrival, termsHash);
    }

    function verifyArrival(
        bytes32 flightKey,
        uint64 scheduledArrival,
        uint64 actualArrival,
        uint8 agreeingSources,
        bytes32 evidenceHash
    ) external onlyOracle whenNotPaused {
        uint256 sourceCount = _sourceCount(agreeingSources);
        if (
            flightKey == bytes32(0) ||
            activePoliciesByFlight[flightKey] == 0 ||
            sourceCount < 2 ||
            sourceCount > 3 ||
            scheduledArrival == 0 ||
            actualArrival == 0 ||
            actualArrival > block.timestamp ||
            evidenceHash == bytes32(0)
        ) revert InvalidOracleEvidence();

        VerifiedArrival storage arrival = verifiedArrivals[flightKey];
        if (arrival.exists) {
            if (
                arrival.scheduledArrival != scheduledArrival ||
                arrival.actualArrival != actualArrival ||
                arrival.evidenceHash != evidenceHash
            ) revert InvalidOracleEvidence();
            return;
        }

        uint32 delayMinutes;
        if (actualArrival > scheduledArrival) {
            uint256 minutesDelayed = (actualArrival - scheduledArrival) / 60;
            if (minutesDelayed > type(uint32).max) revert InvalidOracleEvidence();
            delayMinutes = uint32(minutesDelayed);
        }
        verifiedArrivals[flightKey] = VerifiedArrival({
            scheduledArrival: scheduledArrival,
            actualArrival: actualArrival,
            delayMinutes: delayMinutes,
            agreeingSources: agreeingSources,
            evidenceHash: evidenceHash,
            exists: true
        });
        emit ArrivalVerified(flightKey, delayMinutes, agreeingSources, evidenceHash);
    }

    function payCompensation(uint256 policyId) external onlyOracle nonReentrant whenNotPaused {
        Policy storage policy = policies[policyId];
        VerifiedArrival storage arrival = verifiedArrivals[policy.flightKey];
        if (
            policy.passenger == address(0) ||
            policy.settled ||
            !arrival.exists ||
            arrival.scheduledArrival != policy.scheduledArrival ||
            policy.scheduledArrival < policy.coverageStartsAt ||
            policy.scheduledArrival > policy.coverageEndsAt
        ) revert PolicyUnavailable();
        if (arrival.delayMinutes < policy.coverageThresholdMinutes) revert DelayNotEligible();

        uint128 payoutWei;
        for (uint256 i; i < policy.tiers.length; ++i) {
            if (policy.tiers[i].minimumDelayMinutes > arrival.delayMinutes) break;
            payoutWei = policy.tiers[i].amountWei;
        }
        if (payoutWei == 0) revert DelayNotEligible();

        uint256 amountWei = payoutWei > policy.maximumPayoutWei ? policy.maximumPayoutWei : payoutWei;
        if (address(this).balance < amountWei) revert InsufficientPoolBalance();
        policy.settled = true;
        policy.paid = true;
        (bool success, ) = payable(policy.passenger).call{value: amountWei}("");
        if (!success) revert TransferFailed();
        activePoliciesByFlight[policy.flightKey] -= 1;
        emit CompensationPaid(policyId, policy.passenger, amountWei, arrival.delayMinutes);
    }

    function settleIneligiblePolicy(uint256 policyId) external onlyOracle whenNotPaused {
        Policy storage policy = policies[policyId];
        VerifiedArrival storage arrival = verifiedArrivals[policy.flightKey];
        if (
            policy.passenger == address(0) ||
            policy.settled ||
            !arrival.exists ||
            arrival.scheduledArrival != policy.scheduledArrival ||
            arrival.delayMinutes >= policy.coverageThresholdMinutes
        ) revert PolicyUnavailable();
        policy.settled = true;
        activePoliciesByFlight[policy.flightKey] -= 1;
        emit PolicySettled(policyId, arrival.delayMinutes);
    }

    function getPolicy(uint256 policyId) external view returns (
        address passenger,
        bytes32 flightKey,
        uint64 scheduledArrival,
        uint64 coverageStartsAt,
        uint64 coverageEndsAt,
        uint32 coverageThresholdMinutes,
        uint128 maximumPayoutWei,
        uint128 premiumWei,
        bool paid,
        bool settled,
        Tier[] memory tiers
    ) {
        Policy storage policy = policies[policyId];
        return (
            policy.passenger,
            policy.flightKey,
            policy.scheduledArrival,
            policy.coverageStartsAt,
            policy.coverageEndsAt,
            policy.coverageThresholdMinutes,
            policy.maximumPayoutWei,
            policy.premiumWei,
            policy.paid,
            policy.settled,
            policy.tiers
        );
    }

    function poolBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _sourceCount(uint8 bitmap) private pure returns (uint256 count) {
        if (bitmap == 0 || bitmap > 7) return 0;
        for (uint8 i; i < 3; ++i) {
            if ((bitmap & (1 << i)) != 0) ++count;
        }
    }
}
