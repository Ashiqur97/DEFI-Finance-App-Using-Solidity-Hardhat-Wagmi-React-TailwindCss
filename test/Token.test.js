const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token", function () {
  let Token;
  let token;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TT");
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
    const addr1Balance = await token.balanceOf(addr1.address);
    expect(addr1Balance).to.equal(100);
  });

  it("Should transfer tokens between accounts", async function () {
    await token.transfer(addr1.address, 100);
    const addr1Balance = await token.balanceOf(addr1.address);
    expect(addr1Balance).to.equal(100);
  });
  
});