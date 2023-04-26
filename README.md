# AlgoTrade
This is a project made to design and backtest automated trading strategies - without the need to code anything.

# Adding API Data
***API Data is NOT encrypted! Use at your own risk***
The beginning screen allows you to add as many account connections to each supported brokerage/exchange as you want. These are stored in a text file in JSON format.

# Retrieving Data
As of now, you can either load in data from a file (right now only works with aggregated trades sorted by timestamp, amount, and price) or
by pulling from a supported brokerage/exchange with your API token.

# Supported APIs
- Kraken
- TD Ameritrade
- eTrade (coming soon)


# Goals
Ability to trade live based on created strategy object