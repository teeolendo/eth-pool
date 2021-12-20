import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { BigNumber } from "ethers"
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

  beforeEach( async () => {
    [owner, depositor1, depositor2, depositor3] = await ethers.getSigners()
    ethPoolContract = await ethers.getContractFactory("EthPool")
    ethPool = await ethPoolContract.connect(owner).deploy()
    await ethPool.deployed()
  })

  describe("Deployment", () => {
    it("current period is 0", async function () {
      expect(await ethPool.currentPeriod()).to.equal(0)
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
      const currentPeriod: BigNumber = await ethPool.currentPeriod()
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.depositsPerWeek(currentPeriod, depositor1.address)).to.equal(deposit)
    })

    it("updates total deposits", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const currentPeriod: BigNumber = await ethPool.currentPeriod()
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.deposits(depositor1.address)).to.equal(deposit)
    })

    it("updates total deposits for multiple deposits per week", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const doubleBalance = ethers.utils.parseEther(doubleDeposit.toString())
      const currentPeriod: BigNumber = await ethPool.currentPeriod()
      await ethPool.connect(depositor1).deposit({value: deposit})
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.depositsPerWeek(currentPeriod, depositor1.address)).to.equal(doubleBalance)
    })

    it("updates total deposits for multiple deposits", async function () {
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const doubleBalance = ethers.utils.parseEther(doubleDeposit.toString())
      await ethPool.connect(depositor1).deposit({value: deposit})
      await ethPool.connect(depositor1).deposit({value: deposit})
      expect(await ethPool.deposits(depositor1.address)).to.equal(doubleBalance)
    })
  })

  describe("Rewards", () => {
    // it("only whitelist can upgrade rewards", async function () {
    //   const reward = ethers.utils.parseEther(standardDeposit.toString())
    //   const payload = {value: reward}
    //   const trx = await ethPool.connect(depositor1).reward(false, payload)
    //   expect(trx).to.be.revertedWith("EP ONLY_ALLOWLISTED")
    // })

    it("receives rewards from owner", async function () {
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      const payload = {value: reward}
      const currentPeriod = 0
      await ethPool.connect(owner).reward(false, payload)
      const totalRewardsThisWeek = await ethPool.connect(owner).totalRewardsPerWeek(currentPeriod);
      expect(totalRewardsThisWeek).to.equal(reward)
    })

    it("receives rewards an advances the week", async function () {
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      const payload = {value: reward}
      const expectedPeriod = 1
      await ethPool.connect(owner).reward(true, payload)
      const currentPeriod = await ethPool.connect(owner).currentPeriod()
      expect(currentPeriod).to.equal(expectedPeriod)
    })
  })

  describe("Withdrawal", () => {
    // it("reverts if no deposits have been received", async function () {
    //   const trx = await ethPool.connect(depositor1).withdraw()
    //   expect(trx).to.be.revertedWith("EP:: NO_FUNDS_DEPOSITED")
    // })

    it("withdraws direct deposits when no rewards submitted", async function () {
      const reward = ethers.utils.parseEther(standardDeposit.toString())
      const deposit = ethers.utils.parseEther(standardDeposit.toString())
      const payload = {value: reward}
      const currentPeriod = 0
      await ethPool.connect(depositor1).deposit({value: deposit})
      await ethPool.connect(owner).reward(false, payload)
      const totalRewardsThisWeek = await ethPool.connect(owner).totalRewardsPerWeek(currentPeriod);
      expect(totalRewardsThisWeek).to.equal(reward)
    })
  })
})
