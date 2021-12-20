//SPDX-License-Identifier: Unlicenses
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title Rewards contracts that accepts deposits and distributes rewards weekly
/// @author Tony Olendo
/// @notice Accepts ether and distributes rewards to members
contract EthPool is Ownable {
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.UintSet;

  /* @dev 
    Struct that implements the OZ Enumerable set.
    This ensures all create, read, update operations are O(1).
    Iterating through the array is O(n).
  */
  struct UserDeposits {
    EnumerableSet.UintSet weeklyDepositSet;
  }

  mapping(address => uint) public deposits;
  
  /* @dev depositsPerWeek maps unique weekly deposits, 
  it maps weeknumber -> address -> total deposits for that week */
  mapping(uint => mapping(address => uint)) public depositsPerWeek;
  
  mapping(uint => uint) public totalRewardsPerWeek;
  mapping(uint => uint) internal totalDepositsPerWeek;
  mapping(address => bool) private _allowList;
  mapping(address => UserDeposits) uniqueWeeklyDeposits;

  uint public currentWeek;
  uint internal constant PRECISION_OFFSET = 10 ** 4;

  event DepositReceived(address indexed depositor, uint amount);
  event RewardsReceived(address indexed rewarder, uint amount);
  event FundsWithdrawn(address indexed rewarder, uint amount);
  event WeekAdvanced(uint newWeek);

  constructor(){
    _allowList[msg.sender] = true;
  }

  /**
  * @dev Allow only whitelisted address.
  */
  modifier onlyAllowList() {
    require(_allowList[msg.sender], "EP ONLY_ALLOWLISTED");
    _;
  }

  function showUniqueWeeklyDeposits(address depositor) public view returns (uint[] memory arr){
    UserDeposits storage uniqueDeposits = uniqueWeeklyDeposits[depositor];
    arr = uniqueDeposits.weeklyDepositSet.values();
  }

  function deposit() external payable {
    require(msg.value > 0, "EP SEND_MORE_ETHER");
    
    uint depositsThisWeek = depositsPerWeek[currentWeek][msg.sender];
    uint totalDeposits = deposits[msg.sender];
    uint _totalDepositsThisWeek = totalDepositsPerWeek[currentWeek];

    UserDeposits storage _uniqueWeeklyDeposits = uniqueWeeklyDeposits[msg.sender];
    EnumerableSet.UintSet storage weeklyDeposit = _uniqueWeeklyDeposits.weeklyDepositSet;
    weeklyDeposit.add(currentWeek);

    depositsPerWeek[currentWeek][msg.sender] = depositsThisWeek.add(msg.value);
    deposits[msg.sender] = totalDeposits.add(msg.value);
    totalDepositsPerWeek[currentWeek] = _totalDepositsThisWeek.add(msg.value);
    
    emit DepositReceived(msg.sender, msg.value);
  }

  function reward(bool moveWeek) external payable onlyAllowList {
    require(msg.value > 0, "EP:: SEND_MORE_REWARDS");
    totalRewardsPerWeek[currentWeek] += msg.value;
    if(moveWeek){
      _advanceWeek();
    }
    emit RewardsReceived(msg.sender, msg.value);
  }

  function withdraw(address payable to) external payable returns (uint) {
    require(deposits[msg.sender] > 0, "EP:: NO_FUNDS_DEPOSITED");
    
    uint totalEligibleRewards;
    uint totalUserDeposits = deposits[msg.sender];
    deposits[msg.sender] = 0;
    
    UserDeposits storage _uniqueWeeklyDeposits = uniqueWeeklyDeposits[msg.sender];
    uint[] memory arr = _uniqueWeeklyDeposits.weeklyDepositSet.values();

    for (uint i = 0; i < arr.length; i++) {
      uint _totalWeeklyRewards = totalRewardsPerWeek[arr[i]];
      uint _totalUserWeeklyDeposits = depositsPerWeek[arr[i]][msg.sender] * PRECISION_OFFSET;
      uint _totalDepositsPerWeek = totalDepositsPerWeek[arr[i]];

      depositsPerWeek[arr[i]][msg.sender] = 0;

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

  function advanceWeek() external onlyAllowList {
    _advanceWeek();
  }

  function allowList(address _address, bool allow) external onlyOwner {
    _allowList[_address] = allow;
  }

  function _advanceWeek() internal {
    currentWeek++;
    emit WeekAdvanced(currentWeek);
  } 

}

