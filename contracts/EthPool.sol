//SPDX-License-Identifier: Unlicenses
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title Rewards contracts that accepts deposits and distributes rewards weekly
/// @author Tony Olendo
/// @notice Accepts ether and distributes rewards to members
contract EthPool is Ownable {
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.UintSet;

  /** a
    @dev Struct that implements the OZ Enumerable set.
    This ensures all create, read, update operations are O(1).
    Iterating through the array is O(n).
  */
  struct UserDeposits {
    EnumerableSet.UintSet weeklyDepositSet;
  }

  uint16 public maxNoOfUniqueWeeks;
  uint public currentWeek;
  uint internal constant PRECISION_OFFSET = 10 ** 4;

  mapping(address => uint) public deposits;
  
  /**
    @dev depositsPerWeek maps unique weekly deposits, 
    it maps weeknumber -> address -> total deposits for that week
  */
  mapping(uint => mapping(address => uint)) public depositsPerWeek;
  
  mapping(uint => uint) public totalRewardsPerWeek;
  mapping(uint => uint) internal totalDepositsPerWeek;
  mapping(address => bool) private _allowList;
  mapping(address => UserDeposits) uniqueWeeklyDeposits;

  event DepositReceived(address indexed depositor, uint amount);
  event RewardsReceived(address indexed rewarder, uint amount);
  event FundsWithdrawn(address indexed rewarder, uint amount);
  event WeekAdvanced(uint newWeek);
  event UniqueMaxUpdated(uint16 newMax);

  constructor(uint16 _maxNoOfUniqueWeeks){
    _allowList[msg.sender] = true;
    maxNoOfUniqueWeeks = _maxNoOfUniqueWeeks;
  }

  /// @dev Allow only whitelisted address.
  modifier onlyAllowList() {
    require(_allowList[msg.sender], "EP ONLY_ALLOWLISTED");
    _;
  }
  
  /// @notice Show a depositors Unique Weekly Deposits.
  /// @dev    This operation is O(n) and can consume considerable gas
  function showUniqueWeeklyDeposits(address depositor) external view returns (uint[] memory arr){
    UserDeposits storage uniqueDeposits = uniqueWeeklyDeposits[depositor];
    arr = uniqueDeposits.weeklyDepositSet.values();
  }

  /// @notice Update Max No. of Unique Weeks
  function updateUniqueMaxNoOfWeeks(uint16 newMax) external onlyOwner {
    maxNoOfUniqueWeeks = newMax;
  }

  /// @notice Show the total Unique Weekly Deposits for a given address.
  /// @dev    This operation is O(1)
  function totalUniqueWeeklyDeposits(address depositor) external view returns (uint){
    UserDeposits storage uniqueDeposits = uniqueWeeklyDeposits[depositor];
    return uniqueDeposits.weeklyDepositSet.length();
  }

  function allowList(address _address, bool allow) external onlyOwner {
    _allowList[_address] = allow;
  }

  function advanceWeek() external onlyAllowList {
    _advanceWeek();
  }

  /**
    @notice Deposit funds into the pool
    @dev Due to gas constraints in iterating through the array in rewards,
    we limit the max of number of unique deposits to a value set by the owner
  */
  function deposit() external payable {
    require(msg.value > 0, "EP SEND_MORE_ETHER");
    
    UserDeposits storage _uniqueWeeklyDeposits = uniqueWeeklyDeposits[msg.sender];
    EnumerableSet.UintSet storage weeklyDeposit = _uniqueWeeklyDeposits.weeklyDepositSet;
    require(weeklyDeposit.length() < maxNoOfUniqueWeeks, "EP:: WITHDRAW_FUNDS_BEFORE_DEPOSITING");

    uint depositsThisWeek = depositsPerWeek[currentWeek][msg.sender];
    uint totalDeposits = deposits[msg.sender];
    uint _totalDepositsThisWeek = totalDepositsPerWeek[currentWeek];

    // Update Enumerable Set
    weeklyDeposit.add(currentWeek);

    // Other State Updates
    depositsPerWeek[currentWeek][msg.sender] = depositsThisWeek.add(msg.value);
    deposits[msg.sender] = totalDeposits.add(msg.value);
    totalDepositsPerWeek[currentWeek] = _totalDepositsThisWeek.add(msg.value);
    
    emit DepositReceived(msg.sender, msg.value);
  }

  /// @notice Deposits rewards into a pool. 
  /// Optional paramter to move the period to a new week.
  function reward(bool moveWeek) external payable onlyAllowList {
    require(msg.value > 0, "EP:: SEND_MORE_REWARDS");
    totalRewardsPerWeek[currentWeek] += msg.value;
    
    if(moveWeek) {
      _advanceWeek();
    }

    emit RewardsReceived(msg.sender, msg.value);
  }

  function withdraw(address payable to) external payable {
    require(deposits[msg.sender] > 0, "EP:: NO_FUNDS_DEPOSITED");
    
    uint totalEligibleRewards;
    uint totalUserDeposits = deposits[msg.sender];
    deposits[msg.sender] = 0;
    
    /// Initialize memory array based on Enumerable Set
    UserDeposits storage _uniqueWeeklyDeposits = uniqueWeeklyDeposits[msg.sender];
    EnumerableSet.UintSet storage weeklyDeposit = _uniqueWeeklyDeposits.weeklyDepositSet;
    uint[] memory arr = _uniqueWeeklyDeposits.weeklyDepositSet.values();

    /// Calculate Rewards by iterating through weeks
    for (uint i = 0; i < arr.length; i++) {
      uint _totalWeeklyRewards = totalRewardsPerWeek[arr[i]];
      uint _totalUserWeeklyDeposits = depositsPerWeek[arr[i]][msg.sender] * PRECISION_OFFSET;
      uint _totalDepositsPerWeek = totalDepositsPerWeek[arr[i]];

      depositsPerWeek[arr[i]][msg.sender] = 0;
      weeklyDeposit.remove(i);

      if(_totalWeeklyRewards > 0){
        uint shareOfWeeklyDeposits = _totalUserWeeklyDeposits.div(_totalDepositsPerWeek);
        totalEligibleRewards += (_totalWeeklyRewards.mul(shareOfWeeklyDeposits)).div(PRECISION_OFFSET);
      }
    }

    uint withdrawAmount = totalEligibleRewards + totalUserDeposits;
    (bool sent,) = to.call{value: withdrawAmount}("");
    require(sent, "EP:: ETHER_NOT_SENT");
    emit FundsWithdrawn(msg.sender, withdrawAmount);
  }

  function _advanceWeek() internal {
    currentWeek++;
    emit WeekAdvanced(currentWeek);
  } 

}

