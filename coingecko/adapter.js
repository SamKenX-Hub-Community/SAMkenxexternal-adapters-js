const { Requester, Validator } = require('@chainlink/external-adapter')

const ENDPOINT_PRICE = 'price'
const ENDPOINT_MKTCAP = 'globalmarketcap'

const DEFAULT_ENDPOINT = ENDPOINT_PRICE

const customError = (data) => {
  if (Object.keys(data).length === 0) return true
  return false
}

const presetTickers = {
  COMP: 'compound-governance-token',
  FNX: 'finnexus',
  UNI: 'uniswap',
}

const convertFromTicker = (ticker, coinId, callback) => {
  if (typeof coinId !== 'undefined') return callback(coinId.toLowerCase())

  // Correct common tickers that are misidentified
  if (ticker in presetTickers) {
    return callback(presetTickers[ticker])
  }

  Requester.request(
    {
      url: 'https://api.coingecko.com/api/v3/coins/list',
    },
    customError
  )
    .then((response) => {
      const coin = response.data.find(
        (x) => x.symbol.toLowerCase() === ticker.toLowerCase()
      )
      if (typeof coin === 'undefined') {
        return callback('undefined')
      }
      return callback(coin.id.toLowerCase())
    })
    .catch(() => {
      return callback('Could not find data')
    })
}

const priceParams = {
  base: ['base', 'from', 'coin'],
  quote: ['quote', 'to', 'market'],
  coinid: false,
}

const price = (jobRunID, input, callback) => {
  const validator = new Validator(callback, input, priceParams)
  const symbol = validator.validated.data.base
  convertFromTicker(symbol, validator.validated.data.coinid, (coin) => {
    const url = 'https://api.coingecko.com/api/v3/simple/price'
    const market = validator.validated.data.quote

    const params = {
      ids: coin,
      vs_currencies: market,
    }

    const config = {
      url: url,
      params,
    }

    Requester.request(config, customError)
      .then((response) => {
        response.data.result = Requester.validateResultNumber(response.data, [
          coin.toLowerCase(),
          market.toLowerCase(),
        ])
        callback(response.status, Requester.success(jobRunID, response))
      })
      .catch((error) => {
        callback(500, Requester.errored(jobRunID, error))
      })
  })
}

const mktcapParams = {
  quote: ['quote', 'to', 'market'],
}

const globalMarketCap = (jobRunID, input, callback) => {
  const validator = new Validator(callback, input, mktcapParams)
  const quote = validator.validated.data.quote
  const url = 'https://api.coingecko.com/api/v3/global'

  const config = {
    url: url,
  }

  const _handleResponse = (response) => {
    response.data.result = Requester.validateResultNumber(response.data, [
      'data',
      'total_market_cap',
      quote.toLowerCase(),
    ])
    callback(response.status, Requester.success(jobRunID, response))
  }

  const _handleError = (error) => {
    callback(500, Requester.errored(jobRunID, error))
  }

  Requester.request(config, customError)
    .then(_handleResponse)
    .catch(_handleError)
}

const customParams = {
  endpoint: false,
}

const execute = (input, callback) => {
  const validator = new Validator(callback, input, customParams)
  const jobRunID = validator.validated.id
  const endpoint = validator.validated.data.endpoint || DEFAULT_ENDPOINT
  switch (endpoint.toLowerCase()) {
    case ENDPOINT_PRICE:
      return price(jobRunID, input, callback)
    case ENDPOINT_MKTCAP:
      return globalMarketCap(jobRunID, input, callback)
    default:
      callback(500, Requester.errored(jobRunID, 'invalid endpoint provided'))
  }
}

module.exports.execute = execute
