import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { BigNumber, PayableOverrides } from "ethers"
import { ethers } from "hardhat"
import { EthPool, EthPool__factory } from "../typechain"

describe("EthPool", () => {
  let ethPool: EthPool
  let ethPoolContract: EthPool__factory
  let owner: SignerWithAddress
  let depositor1: SignerWithAddress
  let depositor2: SignerWithAddress
  let depositor3: SignerWithAddress
  const standardDeposit = 300
  const doubleDeposit = 600
  const MAX_UNIQUE_WEEKLY_DEPOSITS = 5

  beforeEach( async () => {
    [owner, depositor1, depositor2, depositor3] = await ethers.getSigners()
    ethPoolContract = await ethers.getContractFactory("EthPool")
    ethPool = await ethPoolContract.connect(owner).deploy(MAX_UNIQUE_WEEKLY_DEPOSITS)
    await ethPool.deployed()
  })

  describe("Deployment", () => {
    it("current period is 0", async function () {
      expect(await ethPool.currentWeek()).to.equal(0)
    })

    it("current period is 0", async function () {
      expect(await ethPool.currentWeek()).to.equal(0)
    })
  })

  describe("Deposits", () => {
    it("allow deposits of ether", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const trx = await ethPool.connect(depositor1).deposit({value: deposit})
      expect(trx).to.emit(ethPool, "DepositReceived")
    })

    it("updated deposits per week value correctly", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const currentWeek: BigNumber = await ethPool.currentWeek()
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.depositsPerWeek(currentWeek, depositor1.address)).to.equal(deposit)
    })

    it("updates total deposits", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const currentWeek: BigNumber = await ethPool.currentWeek()
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.deposits(depositor1.address)).to.equal(deposit)
    })

    it("updates total deposits for multiple deposits per week", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const doubleBalance = ethers.utils.parseEther(doubleDeposit.toString())
      const currentWeek: BigNumber = await ethPool.currentWeek()
      await ethPool.connect(depositor1).deposit({value: deposit})
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.depositsPerWeek(currentWeek, depositor1.address)).to.equal(doubleBalance)
    })

    it("updates total deposits for multiple deposits", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const doubleBalance = ethers.utils.parseEther(doubleDeposit.toString())
      await ethPool.connect(depositor1).deposit({value: deposit})
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.deposits(depositor1.address)).to.equal(doubleBalance)
    })

    it("reverts if no of unique deposits exceeds max", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      for (let i = 0; i < MAX_UNIQUE_WEEKLY_DEPOSITS; i++) {
        await ethPool.connect(depositor1).deposit({value: deposit})
        await ethPool.connect(owner).reward(true, {value: deposit})
      }
      const trx = ethPool.connect(depositor1).deposit({value: deposit})
      await expect(trx).to.be.revertedWith("EP:: WITHDRAW_FUNDS_BEFORE_DEPOSITING")
    })
  })

  describe("Rewards", () => {
    it("only whitelist can add rewards", async function () {
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      const payload = {value: reward}
      const trx = ethPool.connect(depositor1).reward(false, payload)
      await expect(trx).to.be.revertedWith("EP ONLY_ALLOWLISTED")
    })

    it("receives rewards from owner", async function () {
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      const payload = {value: reward}
      const currentWeek = 0
      await ethPool.connect(owner).reward(false, payload)
      const totalRewardsThisWeek = await ethPool.connect(owner).totalRewardsPerWeek(currentWeek);
      expect(totalRewardsThisWeek).to.equal(reward)
    })

    it("receives rewards and advances the week", async function () {
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      const payload = {value: reward}
      const expectedWeek = 1
      await ethPool.connect(owner).reward(true, payload)
      const currentWeek = await ethPool.connect(owner).currentWeek()
      expect(currentWeek).to.equal(expectedWeek)
    })
  })

  describe("Withdrawal", () => {
    it("reverts if no deposits have been received", async function () {
      const trx = ethPool.connect(depositor1).withdraw(depositor1.address);
      await expect(trx).to.be.revertedWith("EP:: NO_FUNDS_DEPOSITED")
    })

    it("withdraws only direct deposits when no rewards submitted", async function () {
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const payload = {value: reward}
      const currentWeek = 0
      await ethPool.connect(depositor1).deposit({value: deposit})
      await ethPool.connect(owner).reward(false, payload)
      const totalRewardsThisWeek = await ethPool.connect(owner).totalRewardsPerWeek(currentWeek);
      expect(totalRewardsThisWeek).to.equal(reward)
    })

    it("withdraws rewards ratio: 25%/75% of pool", async function () {
      const reward = ethers.utils.parseEther((200).toString())
      const deposit1 = ethers.utils.parseEther((100).toString())
      const deposit2 = ethers.utils.parseEther((300).toString())
      const depositor1TotalFunds = ethers.utils.parseEther((150).toString())

      await ethPool.connect(depositor1).deposit({value: deposit1})
      await ethPool.connect(depositor2).deposit({value: deposit2})
      await ethPool.connect(owner).reward(false, {value: reward})
      const trx = ethPool.connect(depositor1).withdraw(depositor1.address)
      await expect(trx).to.emit(ethPool, "FundsWithdrawn").withArgs(depositor1.address, depositor1TotalFunds)
    })

    it("withdraws rewards ratio: 100% pool", async function () {
      const reward = ethers.utils.parseEther((150).toString())
      const deposit1 = ethers.utils.parseEther((100).toString())
      const deposit2 = ethers.utils.parseEther((300).toString())
      const depositor1TotalFunds = ethers.utils.parseEther((250).toString())

      await ethPool.connect(depositor1).deposit({value: deposit1})
      await ethPool.connect(owner).reward(true, {value: reward})
      await ethPool.connect(depositor2).deposit({value: deposit2})
      const trx = ethPool.connect(depositor1).withdraw(depositor1.address)
      await expect(trx).to.emit(ethPool, "FundsWithdrawn").withArgs(depositor1.address, depositor1TotalFunds)
    })

    it("withdraws rewards ratio: 12.5%/37.5%/50% pool", async function () {
      const reward = ethers.utils.parseEther((400).toString())
      const deposit1 = ethers.utils.parseEther((100).toString())
      const deposit2 = ethers.utils.parseEther((300).toString())
      const deposit3 = ethers.utils.parseEther((400).toString())
      const depositor2TotalFunds = ethers.utils.parseEther((450).toString())

      await ethPool.connect(depositor1).deposit({value: deposit1})
      await ethPool.connect(depositor2).deposit({value: deposit2})
      await ethPool.connect(depositor3).deposit({value: deposit3})
      await ethPool.connect(owner).reward(false, {value: reward})
      const trx = ethPool.connect(depositor2).withdraw(depositor2.address)
      await expect(trx).to.emit(ethPool, "FundsWithdrawn").withArgs(depositor2.address, depositor2TotalFunds)
    })

    it("withdraws low precision", async function () {
      const reward = (587).toString()
      const deposit1 = (123).toString()
      const deposit2 = (237).toString()
      const deposit3 = (122).toString()
      const depositor2TotalFunds = (525).toString()

      await ethPool.connect(depositor1).deposit({value: deposit1})
      await ethPool.connect(depositor2).deposit({value: deposit2})
      await ethPool.connect(depositor3).deposit({value: deposit3})
      await ethPool.connect(owner).reward(false, {value: reward})
      const trx = ethPool.connect(depositor2).withdraw(depositor2.address)
      await expect(trx).to.emit(ethPool, "FundsWithdrawn").withArgs(depositor2.address, depositor2TotalFunds)
    })
  })
})
