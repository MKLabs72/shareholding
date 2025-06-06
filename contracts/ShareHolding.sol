// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// 1) Import PRBMath’s UD60x18 from GitHub (v2.x):
import { ud, UD60x18 } from "https://github.com/PaulRBerg/prb-math/blob/main/src/UD60x18.sol";

// 2) Import OpenZeppelin
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ShareHolding
 * @dev A 100-share ShareHolding system with:
 *   - True exponential price: price = basePrice * exp(growthFactor * volumeInMatic)
 *   - Proportional distribution of purchase proceeds to existing holders
 *   - "System fees" distribution
 *   - Owner-settable limit on max ShareHolding purchase
 *   - Ledger-based approach (shares never leave contract)
 *   - Single-step reinvestRewards() for converting pending NATIVE to new ShareHolding
 *   - Emission of PriceHistory events after every purchase (for on-chain chart data)
 */
contract ShareHolding is Ownable(msg.sender), Pausable, ReentrancyGuard {
     // --------------------------------------
    // Constants & Config
    // --------------------------------------
    uint256 public constant TOTAL_SHARES = 100 * 1e18; // 100 shares in 1e18 precision

    // Price parameters:
    //  - basePrice in wei (e.g. 3000e18 => initial price ~3000 NATIVE)
    //  - growthFactor in 1e18 scale (e.g. 2.31e12 => double every 300k NATIVE)
    uint256 public basePrice;
    uint256 public growthFactor;

    // totalVolumePurchased => in wei (1 NATIVE = 1e18).
    // We treat this as the total NATIVE spent on ShareHolding so far.
    uint256 public totalVolumePurchased;

    // Each address's share balance
    mapping(address => uint256) public shareBalances;

    // Ledger-based NATIVE rewards
    // - pendingSalesRewards: from other users’ buy transactions
    // - pendingSystemRewards: from distributeSystemFees() calls
    mapping(address => uint256) public pendingSalesRewards;
    mapping(address => uint256) public pendingSystemRewards;

    // Basic holder registry
    address[] private _holdersIndex;
    mapping(address => bool) private _isHolder;

    // Bookkeeping for last purchase price
    uint256 public lastPurchasePrice;

    // Owner-settable max purchase (in 1e18 units). e.g. 10e18 => 10 ShareHolding
    uint256 public maxPurchaseShares;

    // A reference block/timestamp to limit how far back you need to parse events
    // if you want to parse from the contract deployment forward
    uint256 public startTimestamp;
    uint256 public startBlock;

    // --------------------------------------
    // Events
    // --------------------------------------

    event Purchase(
        address indexed buyer,
        uint256 maticSpent,
        uint256 sharesBought,
        uint256 newPrice
    );

    event SystemFeesAdded(address indexed from, uint256 amount);

    event RewardsClaimed(
        address indexed user,
        uint256 salesRewards,
        uint256 systemRewards
    );

    event PriceParametersUpdated(uint256 newBasePrice, uint256 newGrowthFactor);

    event MaxPurchaseUpdated(uint256 newMaxPurchase);

    /**
     * @dev Emitted each time _internalBuy finishes.
     * The front end can parse these to build a real-time chart.
     */
    event PriceHistory(
        uint256 indexed timestamp,
        uint256 price,
        uint256 volume
    );

    // --------------------------------------
    // Constructor
    // --------------------------------------
    constructor(
        address moduleArhitect,         // 8%
        address protocolMaintainer,   // 4%
        address securityGuardian,  // 4%
        address liquiditySteward,   // 3%
        address governanceFacilitator, // 2%
        address ecosystemIntegrator,     // 2%
        address analyticsCurator,   // 1%
        address complianceCustodian,   // 2%
        address primaryAppSlot,   // 12%
        address forkReserve1,   // 5%
        address forkReserve2,   // 4%
        address growthCatalystPool,   // 3%
        address insuranceBugBountyFund,   // 5%
        address blockchainNative,   // 9%
        address treasuryShareholders,   // 36%

        uint256 _basePrice,
        uint256 _growthFactor
    ) {
        require(moduleArhitect         != address(0), "ModuleArhitect wallet is zero");
        require(protocolMaintainer   != address(0), "ProtocolMaintainer wallet is zero");
        require(securityGuardian  != address(0), "SecurityGuardian wallet is zero");
        require(liquiditySteward   != address(0), "LiquiditySteward wallet is zero");
        require(governanceFacilitator != address(0), "GovernanceFacilitator wallet is zero");
        require(ecosystemIntegrator     != address(0), "EcosystemIntegrator wallet is zero");
        require(analyticsCurator   != address(0), "AnalyticsCurator wallet is zero");
        require(complianceCustodian   != address(0), "ComplianceCustodian wallet is zero");
        require(primaryAppSlot   != address(0), "PrimaryAppSlot wallet is zero");
        require(forkReserve1   != address(0), "ForkReserve1 wallet is zero");
        require(forkReserve2   != address(0), "ForkReserve2 wallet is zero");
        require(growthCatalystPool   != address(0), "GrowthCatalystPool wallet is zero");
        require(insuranceBugBountyFund   != address(0), "InsuranceBugBountyFund wallet is zero");
        require(blockchainNative   != address(0), "BlockchainNative wallet is zero");
        require(treasuryShareholders   != address(0), "TreasuryShareholders wallet is zero");
        require(_basePrice > 0, "Base price must be > 0");

        basePrice = _basePrice;
        growthFactor = _growthFactor;

        // Distribute the fixed 100 shares
        _setShareBalance(moduleArhitect,         (TOTAL_SHARES * 8) / 100); // 8%
        _setShareBalance(protocolMaintainer,   (TOTAL_SHARES * 4) / 100); // 4%
        _setShareBalance(securityGuardian,  (TOTAL_SHARES * 3) / 100); // 3%
        _setShareBalance(liquiditySteward,   (TOTAL_SHARES * 2) / 100); // 2%
        _setShareBalance(governanceFacilitator, (TOTAL_SHARES * 2) / 100); // 2%
        _setShareBalance(ecosystemIntegrator,     (TOTAL_SHARES * 2)  / 100); // 2%
        _setShareBalance(analyticsCurator,   (TOTAL_SHARES * 1)  / 100); // 1%
        _setShareBalance(complianceCustodian,   (TOTAL_SHARES * 2)  / 100); // 2%
        _setShareBalance(primaryAppSlot,   (TOTAL_SHARES * 12)  / 100); // 12%
        _setShareBalance(forkReserve1,   (TOTAL_SHARES * 5)  / 100); // 5%
        _setShareBalance(forkReserve2,   (TOTAL_SHARES * 4)  / 100); // 4%
        _setShareBalance(growthCatalystPool,   (TOTAL_SHARES * 3)  / 100); // 3%
        _setShareBalance(insuranceBugBountyFund,   (TOTAL_SHARES * 5)  / 100); // 5%
        _setShareBalance(blockchainNative,   (TOTAL_SHARES * 9)  / 100); // 9%
        _setShareBalance(treasuryShareholders,   (TOTAL_SHARES * 36)  / 100); // 36%

        // totalVolumePurchased starts at 0
        lastPurchasePrice = _basePrice;

        // By default, let maxPurchaseShares = 100 ShareHolding (no effective limit)
        maxPurchaseShares = 100e18;

        // Store the block/timestamp at deployment
        startTimestamp = block.timestamp;
        startBlock = block.number;
    }

    // --------------------------------------
    // Purchase & Distribution
    // --------------------------------------

    /**
     * @dev Buy ShareHolding with NATIVE (sent via msg.value).
     * Price is determined by an exponential formula (PRBMath).
     * Payment is immediately credited to existing holders proportionally.
     */
    function buyShares() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No NATIVE sent");
        _internalBuy(msg.sender, msg.value);
    }

    /**
     * @dev Single-step function to convert the user's *pending* NATIVE rewards
     * (sales + system) directly into new ShareHolding, distributing that NATIVE among holders.
     */
    function reinvestRewards() external nonReentrant whenNotPaused {
        uint256 userSales = pendingSalesRewards[msg.sender];
        uint256 userSystem = pendingSystemRewards[msg.sender];
        uint256 totalNCurrency = userSales + userSystem;
        require(totalNCurrency > 0, "No rewards to reinvest");

        // Reset user’s pending to zero
        pendingSalesRewards[msg.sender] = 0;
        pendingSystemRewards[msg.sender] = 0;

        // Now we emulate the same distribution logic as buyShares(),
        // but from 'totalNCurrency' that the user invests from contract balance.
        _internalBuy(msg.sender, totalNCurrency);
    }

    /**
     * @dev Internal function that replicates the "buy" logic,
     * used by buyShares(msg.value) and reinvestRewards() (pending NATIVE).
     * This handles distribution, share rebalancing, price updates, etc.
     */
    function _internalBuy(address buyer, uint256 maticAmount) internal {
        // 1. Determine how many shares for maticAmount
        uint256 currentPrice = _getCurrentPrice();
        uint256 sharesToBuy = (maticAmount * 1e18) / currentPrice;
        require(sharesToBuy > 0, "Not enough NATIVE to buy any fraction");

        // 2. Enforce max purchase limit
        require(sharesToBuy <= maxPurchaseShares, "Exceeds maximum purchase limit");

        // 3. fraction = sharesToBuy / 100 in 1e18 scale
        uint256 fractionTaken = (sharesToBuy * 1e18) / TOTAL_SHARES;
        require(fractionTaken <= 1e18, "Cannot buy more than 100% of shares");

        // Distribute purchase proceeds to existing holders
        for (uint256 i = 0; i < _holdersIndex.length; i++) {
            address holder = _holdersIndex[i];
            uint256 hBalance = shareBalances[holder];
            if (hBalance == 0) continue;

            // lostShares = fractionTaken * hBalance / 1e18
            uint256 lostShares = (hBalance * fractionTaken) / 1e18;
            if (lostShares > 0) {
                shareBalances[holder] = hBalance - lostShares;

                // Weighted portion of maticAmount
                uint256 holderPortion = (maticAmount * lostShares) / sharesToBuy;
                pendingSalesRewards[holder] += holderPortion;
            }
        }

        // 4. Increase buyer's share balance
        _addShares(buyer, sharesToBuy);

        // 5. Update totalVolumePurchased => next buyer sees a higher price
        totalVolumePurchased += maticAmount;

        // 6. Recompute price & store lastPurchasePrice
        uint256 newPrice = _getCurrentPrice();
        lastPurchasePrice = newPrice;

        // Emit a PriceHistory event for on-chain charting
        emit PriceHistory(block.timestamp, newPrice, totalVolumePurchased);

        // Also emit the standard Purchase event
        emit Purchase(buyer, maticAmount, sharesToBuy, newPrice);
    }

    /**
     * @dev Distribute system fees (NATIVE) pro rata among holders.
     * e.g. if your protocol accumulates NATIVE from somewhere, deposit it here
     * so holders can claim it as well.
     */
    function distributeSystemFees() public payable nonReentrant {
        require(msg.value > 0, "No NATIVE to distribute");

        uint256 totalShares_ = _getTotalShareBalances();
        require(totalShares_ > 0, "No shares exist?");

        uint256 amount = msg.value;
        for (uint256 i = 0; i < _holdersIndex.length; i++) {
            address holder = _holdersIndex[i];
            uint256 hBalance = shareBalances[holder];
            if (hBalance == 0) continue;

            uint256 shareCut = (amount * hBalance) / totalShares_;
            pendingSystemRewards[holder] += shareCut;
        }

        emit SystemFeesAdded(msg.sender, amount);
    }

    /**
     * @dev Claim all your accumulated NATIVE from share sales + system fees.
     */
    function claimRewards() external nonReentrant {
        uint256 sales = pendingSalesRewards[msg.sender];
        uint256 system = pendingSystemRewards[msg.sender];
        require(sales > 0 || system > 0, "No rewards to claim");

        pendingSalesRewards[msg.sender] = 0;
        pendingSystemRewards[msg.sender] = 0;

        uint256 totalPayout = sales + system;
        (bool success, ) = payable(msg.sender).call{value: totalPayout}("");
        require(success, "Transfer failed");

        emit RewardsClaimed(msg.sender, sales, system);
    }

    // --------------------------------------
    // Admin Functions
    // --------------------------------------

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Update basePrice or growthFactor midstream.
     * For example, if NATIVE's USD price changes drastically,
     * you can rebase to keep the ShareHolding curve aligned with your targets.
     */
    function updatePriceParameters(uint256 newBasePrice, uint256 newGrowthFactor)
        external
        onlyOwner
    {
        require(newBasePrice > 0, "Base price must be > 0");
        basePrice = newBasePrice;
        growthFactor = newGrowthFactor;
        emit PriceParametersUpdated(newBasePrice, newGrowthFactor);
    }

    /**
     * @dev Limit how many ShareHolding can be bought in one transaction.
     * e.g. setMaxPurchaseShares(10e18) => 10 ShareHolding limit.
     */
    function setMaxPurchaseShares(uint256 newMax) external onlyOwner {
        require(newMax >= 1e18 && newMax <= 100e18, "Invalid max purchase");
        maxPurchaseShares = newMax;
        emit MaxPurchaseUpdated(newMax);
    }

    /**
     * @dev Withdraw leftover NATIVE. Typically 0 if everything is distributed.
     */
    function withdrawNative(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough NATIVE");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdraw failed");
    }

    // --------------------------------------
    // View Functions
    // --------------------------------------

    /**
     * @dev Returns the current price for 1 ShareHolding using exponent from PRBMath.
     * price = basePrice * exp( growthFactor * (totalVolumePurchased / 1e18) )
     *
     * Example: If growthFactor = ln(2)/300000 => doubling every 300k NATIVE volume
     */
    function getCurrentPrice() external view returns (uint256) {
        return _getCurrentPrice();
    }

    /**
     * @dev Returns global stats: current price, last purchase price, total volume, # holders
     */
    function getGlobalStats()
        external
        view
        returns (
            uint256 _currentPrice,
            uint256 _lastPurchasePrice,
            uint256 _totalVolumePurchased,
            uint256 _totalHolders
        )
    {
        _currentPrice = _getCurrentPrice();
        _lastPurchasePrice = lastPurchasePrice;
        _totalVolumePurchased = totalVolumePurchased;
        _totalHolders = _holdersIndex.length;
    }

    /**
     * @dev Returns user-specific stats:
     *   - ShareHolding balance
     *   - Unclaimed sales rewards
     *   - Unclaimed system rewards
     */
    function getUserStats(address user)
        external
        view
        returns (
            uint256 userShares,
            uint256 userSalesRewards,
            uint256 userSystemRewards
        )
    {
        userShares = shareBalances[user];
        userSalesRewards = pendingSalesRewards[user];
        userSystemRewards = pendingSystemRewards[user];
    }

    // --------------------------------------
    // Internal Helpers
    // --------------------------------------

    /**
     * @dev Internal function to compute exponent-based price: base * exp(gf * volumeMatic)
     */
    function _getCurrentPrice() internal view returns (uint256) {
        // Convert totalVolumePurchased (wei) to "volume in NATIVE" => UD60x18
        UD60x18 volumeMatic = ud(totalVolumePurchased).div(ud(1e18));

        // gf => UD60x18 from the growthFactor
        UD60x18 gf = ud(growthFactor);

        // exponentTerm = gf.mul(volumeMatic)
        UD60x18 exponentTerm = gf.mul(volumeMatic);

        // exponentResult = e^(exponentTerm)
        UD60x18 exponentResult = exponentTerm.exp();

        // base => UD60x18
        UD60x18 baseUD = ud(basePrice);

        // finalPrice = base * exponentResult
        UD60x18 finalPrice = baseUD.mul(exponentResult);

        return finalPrice.unwrap();
    }

    /**
     * @dev Helper to set share balance & track holders
     */
    function _setShareBalance(address account, uint256 amount) internal {
        shareBalances[account] = amount;
        _addHolder(account);
    }

    /**
     * @dev Increments share balance & track new holders
     */
    function _addShares(address account, uint256 amount) internal {
        shareBalances[account] += amount;
        _addHolder(account);
    }

    /**
     * @dev If the account is new, track it in _holdersIndex
     */
    function _addHolder(address account) internal {
        if (!_isHolder[account]) {
            _isHolder[account] = true;
            _holdersIndex.push(account);
        }
    }

    /**
     * @dev Sums all share balances
     */
    function _getTotalShareBalances() internal view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < _holdersIndex.length; i++) {
            sum += shareBalances[_holdersIndex[i]];
        }
        return sum;
    }

    // Fallback for receiving NATIVE
receive() external payable {
    // automatically treat incoming NATIVE as "system fees"
    distributeSystemFees();
}
}