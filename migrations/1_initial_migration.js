const Migrations = artifacts.require("Migrations");
const Oasis = artifacts.require("Oasis");


module.exports = function(deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(Oasis);
};
