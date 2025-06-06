// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Industry-standard OpenZeppelin imports
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Revamp
 * @notice Multi-functional DeFi contract for token listing, delisting, deposits, rewards, and revamp token management.
 *
 * Key Features:
 * - Asset listing and delisting with unified fee model (all delistings pay the same fee, sent to shareholding address)
 * - Accumulation and transparent tracking of listing and delisting fees
 * - Deposit tokens plus native (ETH/BNB/etc.), partial/full withdrawals, and capped rewards
 * - Yield distribution based on principal with adjustable fee model
 * - Revamp token collector for permanently burning illiquid assets
 * - Transparent, updatable fee structure, all modifiable by contract owner
 * - Fully non-reentrant, using OpenZeppelin ReentrancyGuard
 * - Open for audit, forking, and DeFi integrations
 */
contract Revamp is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ===== Constants =====
    uint256 constant PRECISION = 1e18;

    // ===== Structs =====

    /// @notice Stores user deposit/reward data
    struct UserInfo {
        uint256 totalContributed; // Principal contributed (native asset)
        uint256 rewardDebt;       // Used for reward calculation
        uint256 claimedSoFar;     // Total rewards claimed/used
    }

    /// @notice Stores metadata for listed tokens
    struct TokenInfo {
        uint256 rate;     // For deposit/withdraw calculation
        address lister;   // Original lister's wallet address
        string logoUrl;   // Token logo URL
    }

    /// @notice Return format for getAllListedTokens()
    struct TokenData {
        address token;
        uint256 rate;
        address lister;
        string logoUrl;
    }

    // ===== State Variables =====

    // Asset/token listing management
    mapping(address => TokenInfo) public tokenInfos;
    address[] private listedTokens;

    // Listing/claim fee settings and accounting
    uint256 public listingFee;
    uint256 public claimFee;
    uint256 public delistFee;
    address public feeRecipient; // Shareholding address for fee distribution
    uint256 public totalListingFees; // Includes listing + delisting fees

    // Additional fee settings for deposits
    uint256 public nativeFeePercent; // Basis points (100 = 1%)
    address public nativeFeeRecipient;
    uint256 public shareholdingFeePercent; // Basis points (100 = 1%)
    address public shareholdingFeeRecipient;

    // Yield distribution variables
    uint256 public totalNativeContributed;
    uint256 public accRewardPerShare;

    // User accounting
    mapping(address => UserInfo) public users;

    // Top 20 participants by principal
    address[] public topParticipants;

    // Revamp (burn/collector) token functionality
    IERC20 public revampToken;
    address public tokenCollector;

    // ===== Events =====
    event AssetListed(address indexed token, uint256 rate, string logoUrl, uint256 feePaid);
    event TokenDelisted(address indexed token, address indexed caller, uint256 feePaid);

    event Deposited(address indexed user, address indexed token, uint256 tokenAmount, uint256 nativeAmount);
    event WithdrawDone(address indexed user, uint256 withdrawnAmount);
    event Claimed(address indexed user, uint256 amount);
    event Reinvested(address indexed user, uint256 amount);

    event TokenMetadataUpdated(address indexed token, string newLogoUrl, uint256 newRate);

    event ListingFeeUpdated(uint256 newFee);
    event DelistFeeUpdated(uint256 newFee);
    event ClaimFeeUpdated(uint256 newFee);
    event NativeFeeUpdated(uint256 newNativeFeePercent, address newNativeFeeRecipient);
    event ShareholdingFeeUpdated(uint256 newShareholdingFeePercent, address newShareholdingFeeRecipient);

    event RevampTokensLocked(address indexed user, uint256 amount);
    event TokenCollectorUpdated(address indexed newCollector);

    // ===== Constructor =====
    constructor(
        uint256 _listingFee,
        address _feeRecipient,
        uint256 _claimFee,
        uint256 _nativeFeePercent,
        address _nativeFeeRecipient,
        uint256 _shareholdingFeePercent,
        address _shareholdingFeeRecipient,
        address _revampToken,
        uint256 _delistFee
    ) Ownable(msg.sender) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_nativeFeeRecipient != address(0), "Invalid native fee recipient");
        require(_shareholdingFeeRecipient != address(0), "Invalid shareholding fee recipient");
        require(_revampToken != address(0), "Invalid revamp token");

        listingFee = _listingFee;
        delistFee = _delistFee;
        feeRecipient = _feeRecipient;
        claimFee = _claimFee;

        nativeFeePercent = _nativeFeePercent;
        nativeFeeRecipient = _nativeFeeRecipient;
        shareholdingFeePercent = _shareholdingFeePercent;
        shareholdingFeeRecipient = _shareholdingFeeRecipient;

        revampToken = IERC20(_revampToken);
    }

    // ===== Asset Listing =====

    /**
     * @notice List a new asset/token by paying a fixed listing fee.
     * @param token The token address to list.
     * @param rate The rate for deposit calculations.
     * @param logoUrl The logo URL for the token.
     */
    function listNewAsset(
        address token,
        uint256 rate,
        string calldata logoUrl
    ) external payable nonReentrant {
        require(msg.value >= listingFee, "Fee too low");
        require(rate > 0, "Rate > 0");
        require(token != address(0), "Bad token");
        require(tokenInfos[token].lister == address(0), "Already listed");

        tokenInfos[token] = TokenInfo({
            rate: rate,
            lister: msg.sender,
            logoUrl: logoUrl
        });
        listedTokens.push(token);

        totalListingFees += msg.value;
        (bool success, ) = feeRecipient.call{value: msg.value}("");
        require(success, "Fee transfer fail");

        emit AssetListed(token, rate, logoUrl, msg.value);
    }

    // ===== Asset Delisting (Unified Fee) =====

    /**
     * @notice Delist an asset. Anyone can delist by paying the unified delisting fee.
     * Fee is added to totalListingFees and forwarded to feeRecipient.
     * @param token The token address to delist.
     */
    function delistAsset(address token) external payable nonReentrant {
        TokenInfo storage info = tokenInfos[token];
        require(info.lister != address(0), "Asset not listed");
        require(msg.value >= delistFee, "Insufficient delist fee");

        totalListingFees += msg.value;
        (bool success, ) = feeRecipient.call{value: msg.value}("");
        require(success, "Fee transfer fail");

        delete tokenInfos[token];
        // Remove from listedTokens array for cleanliness (optional, or just leave for frontend to filter)
        for (uint256 i = 0; i < listedTokens.length; i++) {
            if (listedTokens[i] == token) {
                listedTokens[i] = listedTokens[listedTokens.length - 1];
                listedTokens.pop();
                break;
            }
        }

        emit TokenDelisted(token, msg.sender, msg.value);
    }

    // ===== Token Deposit/Withdraw/Rewards =====

    /**
     * @notice Deposit tokens plus native currency.
     * Deduces fees and updates user principal and global state.
     */
    function deposit(address token, uint256 tokenAmount) external payable nonReentrant {
        TokenInfo storage info = tokenInfos[token];
        require(info.lister != address(0), "Asset not listed");
        require(tokenAmount > 0, "Tokens > 0");
        require(msg.value > 0, "Native > 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        uint256 nativeFee = (msg.value * nativeFeePercent) / 10000;
        uint256 shareFee = (msg.value * shareholdingFeePercent) / 10000;
        uint256 netValue = msg.value - nativeFee - shareFee;

        // Yield distribution
        if (totalNativeContributed > 0) {
            accRewardPerShare += (netValue * PRECISION) / totalNativeContributed;
        }

        UserInfo storage user = users[msg.sender];
        user.totalContributed += netValue;
        totalNativeContributed += netValue;
        user.rewardDebt = (user.totalContributed * accRewardPerShare) / PRECISION;

        _updateTopParticipants(msg.sender);

        // Transfer fees
        if (nativeFee > 0) {
            (bool successNative, ) = nativeFeeRecipient.call{value: nativeFee}("");
            require(successNative, "Native fee fail");
        }
        if (shareFee > 0) {
            (bool successShare, ) = shareholdingFeeRecipient.call{value: shareFee}("");
            require(successShare, "Share fee fail");
        }

        emit Deposited(msg.sender, token, tokenAmount, netValue);
    }

    /**
     * @notice Withdraw (partial or full) from the protocol.
     * Uses rewards first, then principal, subject to cap.
     */
    function withdraw(uint256 amount) public nonReentrant {
        require(amount > 0, "Amt > 0");
        UserInfo storage user = users[msg.sender];
        require(user.totalContributed > 0, "No principal");

        uint256 pending = pendingReward(msg.sender);
        uint256 fromReward;
        uint256 fromPrincipal = 0;
        if (pending >= amount) {
            fromReward = amount;
        } else {
            fromReward = pending;
            fromPrincipal = amount - pending;
        }
        require(fromPrincipal <= user.totalContributed, "Exceeds bal");

        uint256 feePart = 0;
        if (fromReward > 0) {
            require(fromReward > claimFee, "Claim fee high");
            feePart = claimFee;
        }
        uint256 toUser = (fromReward - feePart) + fromPrincipal;
        user.claimedSoFar += fromReward;
        if (fromPrincipal > 0) {
            user.totalContributed -= fromPrincipal;
            totalNativeContributed -= fromPrincipal;
        }
        user.rewardDebt = (user.totalContributed * accRewardPerShare) / PRECISION;
        if (feePart > 0) {
            (bool feeOk, ) = feeRecipient.call{value: feePart}("");
            require(feeOk, "Fee tx fail");
        }
        (bool ok, ) = payable(msg.sender).call{value: toUser}("");
        require(ok, "Withdraw tx fail");

        emit WithdrawDone(msg.sender, amount);
    }

    /**
     * @notice Claim all pending rewards.
     */
    function claim() external {
        uint256 pending = pendingReward(msg.sender);
        require(pending > 0, "No pending");
        withdraw(pending);
        emit Claimed(msg.sender, pending);
    }

    /**
     * @notice Reinvest all pending rewards (no extra fee).
     */
    function reinvest() external nonReentrant {
        uint256 pending = pendingReward(msg.sender);
        require(pending > 0, "No pending");
        UserInfo storage user = users[msg.sender];
        user.claimedSoFar += pending;
        user.totalContributed += pending;
        totalNativeContributed += pending;
        user.rewardDebt = (user.totalContributed * accRewardPerShare) / PRECISION;
        emit Reinvested(msg.sender, pending);
    }

    /**
     * @notice Returns the pending reward for a user (capped at 2x principal).
     */
    function pendingReward(address userAddr) public view returns (uint256) {
        UserInfo storage user = users[userAddr];
        uint256 accumulated = (user.totalContributed * accRewardPerShare) / PRECISION;
        uint256 rawPending = accumulated > user.rewardDebt ? accumulated - user.rewardDebt : 0;
        uint256 maxReward = user.totalContributed * 2;
        uint256 used = user.claimedSoFar;
        if (used >= maxReward) {
            return 0;
        }
        uint256 leftover = maxReward - used;
        return rawPending > leftover ? leftover : rawPending;
    }

    // ===== Top Participants Tracking =====

    function _updateTopParticipants(address userAddr) internal {
        bool exists = false;
        uint256 len = topParticipants.length;
        for (uint256 i = 0; i < len; i++) {
            if (topParticipants[i] == userAddr) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            topParticipants.push(userAddr);
        }
        // Sort in descending order based on totalContributed.
        for (uint256 i = 0; i < topParticipants.length; i++) {
            for (uint256 j = i + 1; j < topParticipants.length; j++) {
                if (users[topParticipants[j]].totalContributed > users[topParticipants[i]].totalContributed) {
                    address temp = topParticipants[i];
                    topParticipants[i] = topParticipants[j];
                    topParticipants[j] = temp;
                }
            }
        }
        if (topParticipants.length > 20) {
            topParticipants.pop();
        }
    }

    function getTopParticipants() external view returns (address[] memory addrs, uint256[] memory amounts) {
        uint256 len = topParticipants.length;
        addrs = new address[](len);
        amounts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            addrs[i] = topParticipants[i];
            amounts[i] = users[topParticipants[i]].totalContributed;
        }
    }

    // ===== Listing Data/Helpers =====

    function getAllListedTokens() external view returns (TokenData[] memory) {
        uint256 len = listedTokens.length;
        TokenData[] memory arr = new TokenData[](len);
        for (uint256 i = 0; i < len; i++) {
            address t = listedTokens[i];
            TokenInfo storage info = tokenInfos[t];
            arr[i] = TokenData({
                token: t,
                rate: info.rate,
                lister: info.lister,
                logoUrl: info.logoUrl
            });
        }
        return arr;
    }

    // ===== Admin: Fee/Config Updates =====

    function updateListingFee(uint256 newFee) external onlyOwner {
        listingFee = newFee;
        emit ListingFeeUpdated(newFee);
    }

    function updateDelistFee(uint256 newFee) external onlyOwner {
        delistFee = newFee;
        emit DelistFeeUpdated(newFee);
    }

    function updateClaimFee(uint256 newFee) external onlyOwner {
        claimFee = newFee;
        emit ClaimFeeUpdated(newFee);
    }

    function updateNativeFee(uint256 newNativeFeePercent, address newRecipient) external onlyOwner {
        nativeFeePercent = newNativeFeePercent;
        nativeFeeRecipient = newRecipient;
        emit NativeFeeUpdated(newNativeFeePercent, newRecipient);
    }

    function updateShareholdingFee(uint256 newShareholdingFeePercent, address newRecipient) external onlyOwner {
        shareholdingFeePercent = newShareholdingFeePercent;
        shareholdingFeeRecipient = newRecipient;
        emit ShareholdingFeeUpdated(newShareholdingFeePercent, newRecipient);
    }

    function exportVitalData() external view onlyOwner returns (
        uint256 _totalNativeContributed,
        uint256 _accRewardPerShare,
        uint256 _totalListingFees
    ) {
        _totalNativeContributed = totalNativeContributed;
        _accRewardPerShare = accRewardPerShare;
        _totalListingFees = totalListingFees;
    }

    // ===== User: Token Metadata Update =====

    /**
     * @notice Update metadata (logo, rate) for a listed token.
     * Only callable by the original lister.
     */
    function updateMyTokenMetadata(address token, string calldata newLogoUrl, uint256 newRate) external nonReentrant {
        TokenInfo storage info = tokenInfos[token];
        require(info.lister != address(0), "Asset not listed");
        require(info.lister == msg.sender, "Not lister");
        info.logoUrl = newLogoUrl;
        info.rate = newRate;
        emit TokenMetadataUpdated(token, newLogoUrl, newRate);
    }

    // ===== Revamp Token Collector Functions =====

    /**
     * @notice Owner can update the token collector address.
     */
    function updateTokenCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid collector");
        tokenCollector = newCollector;
        emit TokenCollectorUpdated(newCollector);
    }

    /**
     * @notice Permanently lock (burn) revamp tokens to the collector.
     * User must approve the contract first.
     */
    function lockRevampTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amt > 0");
        require(tokenCollector != address(0), "No collector set");
        revampToken.safeTransferFrom(msg.sender, tokenCollector, amount);
        emit RevampTokensLocked(msg.sender, amount);
    }

    // ===== Receive Fallback (for native transfers) =====
    receive() external payable {}
}
