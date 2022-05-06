pragma solidity >=0.8.4;

interface ChainlinkAggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

interface AggregatorInterface {
    function latestAnswer() external view returns (int256);
}

contract WrappedPriceOracle is AggregatorInterface {
    ChainlinkAggregatorV3Interface private _priceOracle;

    constructor(address priceOracle) {
        _priceOracle = ChainlinkAggregatorV3Interface(priceOracle);
    }

    function decimals() public view returns (uint8 dec) {
        dec = _priceOracle.decimals();
    }

    function latestAnswer() public view override returns (int256) {
        (, int256 answer, , , ) = _priceOracle.latestRoundData();
        return answer;
    }
}
