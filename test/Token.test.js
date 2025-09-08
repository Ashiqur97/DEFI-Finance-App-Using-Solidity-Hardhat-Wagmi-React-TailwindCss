const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token", function () {
  let Token, token, owner, addr1;

  beforeEach(async function () {
    Token = await ethers.getContractFactory("Token");
    [owner, addr1] = await ethers.getSigners();
    token = await Token.deploy("Test Token", "TT", 1000000);
    await token.deployed();
  });

  it("Should have correct name and symbol", async function () {
    expect(await token.name()).to.equal("Test Token");
    expect(await token.symbol()).to.equal("TT");
  });

  it("Should mint initial supply to owner", async function () {
    const ownerBalance = await token.balanceOf(owner.address);
    expect(await token.totalSupply()).to.equal(ownerBalance);
  });

  it("Should allow owner to mint tokens", async function () {
    await token.mint(addr1.address, 100);
    expect(await token.balanceOf(addr1.address)).to.equal(ethers.utils.parseUnits("100", 18));
  });

  it("Should increase total supply when minting", async function () {
    const initialSupply = await token.totalSupply();
    await token.mint(addr1.address, 100);
    expect(await token.totalSupply()).to.equal(initialSupply.add(ethers.utils.parseUnits("100", 18)));
  });

  it("Should transfer tokens between accounts", async function () {
    await token.transfer(addr1.address, 100);
    expect(await token.balanceOf(addr1.address)).to.equal(100);
    expect(await token.balanceOf(owner.address)).to.equal(
      ethers.utils.parseUnits("1000000", 18).sub(100)
    );
  });

  it("Should fail to transfer more than balance", async function () {
    await expect(
      token.transfer(addr1.address, ethers.utils.parseUnits("1000001", 18))
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("Should fail if non-owner tries to mint", async function () {
    await expect(
      token.connect(addr1).mint(addr1.address, 100)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});