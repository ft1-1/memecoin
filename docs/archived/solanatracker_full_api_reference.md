# Solana Tracker – Full REST API Reference  

*Scraped 2025-07-30 19:15 UTC*

## Table of Contents
1. [GET /tokens/{tokenAddress} - Get Token Information](#get-tokenstokenaddress-get-token-information)
2. [GET /tokens/{tokenAddress}](#get-tokenstokenaddress)
3. [GET /tokens/by-pool/{poolAddress} - Get Token by Pool Address](#get-tokensby-poolpooladdress-get-token-by-pool-address)
4. [GET /tokens/by-pool/{poolAddress}](#get-tokensby-poolpooladdress)
5. [GET /tokens/{tokenAddress}/holders - Get Token Holders](#get-tokenstokenaddressholders-get-token-holders)
6. [GET /tokens/{tokenAddress}/holders](#get-tokenstokenaddressholders)
7. [GET /tokens/{tokenAddress}/holders/top - Get Top 20 Token Holders](#get-tokenstokenaddressholderstop-get-top-20-token-holders)
8. [GET /tokens/{tokenAddress}/holders/top](#get-tokenstokenaddressholderstop)
9. [GET /tokens/{tokenAddress}/ath - Get All-Time High Price](#get-tokenstokenaddressath-get-all-time-high-price)
10. [GET /tokens/{tokenAddress}/ath](#get-tokenstokenaddressath)
11. [GET /deployer/{wallet} - Get Tokens by Deployer](#get-deployerwallet-get-tokens-by-deployer)
12. [GET /deployer/{wallet}](#get-deployerwallet)
13. [GET /search - Advanced Token Search](#get-search-advanced-token-search)
14. [GET /search](#get-search)
15. [GET /tokens/latest - Get Latest Tokens](#get-tokenslatest-get-latest-tokens)
16. [GET /tokens/latest](#get-tokenslatest)
17. [POST /tokens/multi - Get Multiple Tokens](#post-tokensmulti-get-multiple-tokens)
18. [POST /tokens/multi](#post-tokensmulti)
19. [GET /tokens/trending - Get Trending Tokens](#get-tokenstrending-get-trending-tokens)
20. [GET /tokens/trending](#get-tokenstrending)
21. [GET /tokens/trending/{timeframe}](#get-tokenstrendingtimeframe)
22. [GET /tokens/volume - Get Tokens by Volume](#get-tokensvolume-get-tokens-by-volume)
23. [GET /tokens/volume](#get-tokensvolume)
24. [GET /tokens/volume/{timeframe}](#get-tokensvolumetimeframe)
25. [GET /tokens/multi/all - Get Token Overview](#get-tokensmultiall-get-token-overview)
26. [GET /tokens/multi/all](#get-tokensmultiall)
27. [GET /tokens/multi/graduated - Get Graduated Tokens](#get-tokensmultigraduated-get-graduated-tokens)
28. [GET /tokens/multi/graduated](#get-tokensmultigraduated)
29. [GET /price - Get Token Price](#get-price-get-token-price)
30. [GET /price](#get-price)
31. [GET /price/history - Get Historic Price Information](#get-pricehistory-get-historic-price-information)
32. [GET /price/history](#get-pricehistory)
33. [GET /price/history/timestamp - Get Price at Specific Timestamp](#get-pricehistorytimestamp-get-price-at-specific-timestamp)
34. [GET /price/history/timestamp](#get-pricehistorytimestamp)
35. [GET /price/history/range - Get lowest and highest price in time range](#get-pricehistoryrange-get-lowest-and-highest-price-in-time-range)
36. [GET /price/history/range](#get-pricehistoryrange)
37. [POST /price - Post Token Price](#post-price-post-token-price)
38. [POST /price](#post-price)
39. [GET/POST /price/multi - Get Multiple Token Prices](#getpost-pricemulti-get-multiple-token-prices)
40. [GET /price/multi](#get-pricemulti)
41. [GET /wallet/{owner} - Get Wallet Tokens](#get-walletowner-get-wallet-tokens)
42. [GET /wallet/{owner}](#get-walletowner)
43. [GET /wallet/{owner}/basic - Get Basic Wallet Information](#get-walletownerbasic-get-basic-wallet-information)
44. [GET /wallet/{owner}/basic](#get-walletownerbasic)
45. [GET /wallet/{owner}/page/{page} - Get Wallet Tokens with Pagination](#get-walletownerpagepage-get-wallet-tokens-with-pagination)
46. [GET /wallet/{owner}/page/{page}](#get-walletownerpagepage)
47. [GET /wallet/{owner}/trades - Get Wallet Trades](#get-walletownertrades-get-wallet-trades)
48. [GET /wallet/{owner}/trades](#get-walletownertrades)
49. [GET /wallet/{owner}/chart - Get Wallet Portfolio Chart](#get-walletownerchart-get-wallet-portfolio-chart)
50. [GET /wallet/{owner}/chart](#get-walletownerchart)
51. [GET /trades/{tokenAddress} - Get Token Trades](#get-tradestokenaddress-get-token-trades)
52. [GET /trades/{tokenAddress}](#get-tradestokenaddress)
53. [GET /trades/{tokenAddress}/{poolAddress} - Get Pool-Specific Trades](#get-tradestokenaddresspooladdress-get-pool-specific-trades)
54. [GET /trades/{tokenAddress}/{poolAddress}](#get-tradestokenaddresspooladdress)
55. [GET /trades/{tokenAddress}/{poolAddress}/{owner} - Get User-Specific Pool Trades](#get-tradestokenaddresspooladdressowner-get-user-specific-pool-trades)
56. [GET /trades/{tokenAddress}/{poolAddress}/{owner}](#get-tradestokenaddresspooladdressowner)
57. [GET /trades/{tokenAddress}/by-wallet/{owner} - Get User-Specific Token Trades](#get-tradestokenaddressby-walletowner-get-user-specific-token-trades)
58. [GET /trades/{tokenAddress}/by-wallet/{owner}](#get-tradestokenaddressby-walletowner)
59. [GET /chart/{token} - Get OHLCV Data for a token / pool](#get-charttoken-get-ohlcv-data-for-a-token-pool)
60. [GET /chart/{token}](#get-charttoken)
61. [GET /chart/{token}/{pool}](#get-charttokenpool)
62. [GET /holders/chart/{token} - Get Holders Chart Data](#get-holderscharttoken-get-holders-chart-data)
63. [GET /holders/chart/{token}](#get-holderscharttoken)
64. [GET /top-traders/all - Get Top Traders (All Tokens)](#get-top-tradersall-get-top-traders-all-tokens)
65. [GET /top-traders/all](#get-top-tradersall)
66. [GET /top-traders/all/{page}](#get-top-tradersallpage)
67. [GET /top-traders/{token} - Get Top Traders for Specific Token](#get-top-traderstoken-get-top-traders-for-specific-token)
68. [GET /top-traders/{token}](#get-top-traderstoken)
69. [GET /stats/{token} - Get Token Stats](#get-statstoken-get-token-stats)
70. [GET /stats/{token}](#get-statstoken)
71. [GET /stats/{token}/{pool}](#get-statstokenpool)
72. [GET /events/{tokenAddress} - Get Token Events](#get-eventstokenaddress-get-token-events)
73. [GET /events/{tokenAddress}](#get-eventstokenaddress)
74. [GET /events/{tokenAddress}/{poolAddress} - Get Pool Events](#get-eventstokenaddresspooladdress-get-pool-events)
75. [GET /events/{tokenAddress}/{poolAddress}](#get-eventstokenaddresspooladdress)

---

### GET /tokens/{tokenAddress} - Get Token Information

#### `GET /tokens/{tokenAddress}`

Retrieves comprehensive information about a specific token.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress})

Response
    
    
     
    {
    "token":{
    "name":"OFFICIAL TRUMP",
    "symbol":"TRUMP",
    "mint":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    "uri":"https://arweave.net/cSCP0h2n1crjeSWE9KF-XtLciJalDNFs7Vf-Sm0NNY0",
    "decimals":6,
    "description":"",
    "image":"https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
    "hasFileMetaData":true,
    "strictSocials":{
     
      },
      "creation":{
         "creator":"9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
         "created_tx":"5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
         "created_time":1749298225
      }
     
    },
    "pools":[
    {
    "poolId":"9d9mb8kooFfaD3SctgZtkxQypkshx6ezhbKio89ixyy2",
    "liquidity":{
    "quote":244375150.385549,
    "usd":360839586.0302158
    },
    "price":{
    "quote":9.966770767653129,
    "usd":9.966770767653129
    },
    "tokenSupply":999999453.314508,
    "lpBurn":0,
    "tokenAddress":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    "marketCap":{
    "quote":9966765318.964148,
    "usd":9966765318.964148
    },
    "market":"meteora-dlmm",
    "quoteToken":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "decimals":6,
    "security":{
    "freezeAuthority":null,
    "mintAuthority":null
    },
    "lastUpdated":1743276314161,
    "deployer":"FbMxP3GVq8TQ36nbYgx4NP9iygMpwAwFWJwW81ioCiSF",
    "txns":{
    "buys":96998,
    "total":190413,
    "volume":526726502,
    "volume24h":16726502,
    "sells":93414
    }
    }
    ],
    "events":{
    "1m":{
    "priceChangePercentage":0
    },
    "5m":{
    "priceChangePercentage":-0.4975124378109433
    },
    "15m":{
    "priceChangePercentage":-0.9925496893641157
    },
    "30m":{
    "priceChangePercentage":-0.9925496893641157
    },
    "1h":{
    "priceChangePercentage":0.4999999999999992
    },
    "2h":{
    "priceChangePercentage":1.0025000000000053
    },
    "3h":{
    "priceChangePercentage":-1.485124069019019
    },
    "4h":{
    "priceChangePercentage":-1.485124069019019
    },
    "5h":{
    "priceChangePercentage":-1.485124069019019
    },
    "6h":{
    "priceChangePercentage":-2.462933164049435
    },
    "12h":{
    "priceChangePercentage":-3.4310370179445404
    },
    "24h":{
    "priceChangePercentage":-4.389531960045081
    }
    },
    "risk": {
    "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
    "rugged": false,
    "risks": [],
    "score": 0,
    "jupiterVerified": true
    }
    "buys":0,
    "sells":0,
    "txns":0,
    "holders":651269
    }

---

#### `GET /tokens/{tokenAddress}`

Retrieves comprehensive information about a specific token.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress})

Response
    
    
     
    {
    "token":{
    "name":"OFFICIAL TRUMP",
    "symbol":"TRUMP",
    "mint":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    "uri":"https://arweave.net/cSCP0h2n1crjeSWE9KF-XtLciJalDNFs7Vf-Sm0NNY0",
    "decimals":6,
    "description":"",
    "image":"https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
    "hasFileMetaData":true,
    "strictSocials":{
     
      },
      "creation":{
         "creator":"9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
         "created_tx":"5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
         "created_time":1749298225
      }
     
    },
    "pools":[
    {
    "poolId":"9d9mb8kooFfaD3SctgZtkxQypkshx6ezhbKio89ixyy2",
    "liquidity":{
    "quote":244375150.385549,
    "usd":360839586.0302158
    },
    "price":{
    "quote":9.966770767653129,
    "usd":9.966770767653129
    },
    "tokenSupply":999999453.314508,
    "lpBurn":0,
    "tokenAddress":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    "marketCap":{
    "quote":9966765318.964148,
    "usd":9966765318.964148
    },
    "market":"meteora-dlmm",
    "quoteToken":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "decimals":6,
    "security":{
    "freezeAuthority":null,
    "mintAuthority":null
    },
    "lastUpdated":1743276314161,
    "deployer":"FbMxP3GVq8TQ36nbYgx4NP9iygMpwAwFWJwW81ioCiSF",
    "txns":{
    "buys":96998,
    "total":190413,
    "volume":526726502,
    "volume24h":16726502,
    "sells":93414
    }
    }
    ],
    "events":{
    "1m":{
    "priceChangePercentage":0
    },
    "5m":{
    "priceChangePercentage":-0.4975124378109433
    },
    "15m":{
    "priceChangePercentage":-0.9925496893641157
    },
    "30m":{
    "priceChangePercentage":-0.9925496893641157
    },
    "1h":{
    "priceChangePercentage":0.4999999999999992
    },
    "2h":{
    "priceChangePercentage":1.0025000000000053
    },
    "3h":{
    "priceChangePercentage":-1.485124069019019
    },
    "4h":{
    "priceChangePercentage":-1.485124069019019
    },
    "5h":{
    "priceChangePercentage":-1.485124069019019
    },
    "6h":{
    "priceChangePercentage":-2.462933164049435
    },
    "12h":{
    "priceChangePercentage":-3.4310370179445404
    },
    "24h":{
    "priceChangePercentage":-4.389531960045081
    }
    },
    "risk": {
    "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
    "rugged": false,
    "risks": [],
    "score": 0,
    "jupiterVerified": true
    }
    "buys":0,
    "sells":0,
    "txns":0,
    "holders":651269
    }

---

### GET /tokens/by-pool/{poolAddress} - Get Token by Pool Address

#### `GET /tokens/by-pool/{poolAddress}`

Retrieves token information by searching with a pool address.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/by-pool/{poolAddress})

Response
    
    
    {
    "token":{
      "name":"OFFICIAL TRUMP",
      "symbol":"TRUMP",
      "mint":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      "uri":"https://arweave.net/cSCP0h2n1crjeSWE9KF-XtLciJalDNFs7Vf-Sm0NNY0",
      "decimals":6,
      "description":"",
      "image":"https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
      "hasFileMetaData":true,
      "strictSocials":{
     
      },
      "creation":{
         "creator":"9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
         "created_tx":"5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
         "created_time":1749298225
      }
    },
    "pools":[
      {
         "poolId":"9d9mb8kooFfaD3SctgZtkxQypkshx6ezhbKio89ixyy2",
         "liquidity":{
            "quote":244375150.385549,
            "usd":360839586.0302158
         },
         "price":{
            "quote":9.966770767653129,
            "usd":9.966770767653129
         },
         "tokenSupply":999999453.314508,
         "lpBurn":0,
         "tokenAddress":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
         "marketCap":{
            "quote":9966765318.964148,
            "usd":9966765318.964148
         },
         "market":"meteora-dlmm",
         "quoteToken":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
         "decimals":6,
         "security":{
            "freezeAuthority":null,
            "mintAuthority":null
         },
         "lastUpdated":1743276314161,
         "deployer":"FbMxP3GVq8TQ36nbYgx4NP9iygMpwAwFWJwW81ioCiSF",
         "txns":{
            "buys":96998,
            "total":190413,
            "volume":526726502,
            "volume24h":1726502,
            "sells":93414
         }
      }
    ],
    "events":{
      "1m":{
         "priceChangePercentage":0
      },
      "5m":{
         "priceChangePercentage":-0.4975124378109433
      },
      "15m":{
         "priceChangePercentage":-0.9925496893641157
      },
      "30m":{
         "priceChangePercentage":-0.9925496893641157
      },
      "1h":{
         "priceChangePercentage":0.4999999999999992
      },
      "2h":{
         "priceChangePercentage":1.0025000000000053
      },
      "3h":{
         "priceChangePercentage":-1.485124069019019
      },
      "4h":{
         "priceChangePercentage":-1.485124069019019
      },
      "5h":{
         "priceChangePercentage":-1.485124069019019
      },
      "6h":{
         "priceChangePercentage":-2.462933164049435
      },
      "12h":{
         "priceChangePercentage":-3.4310370179445404
      },
      "24h":{
         "priceChangePercentage":-4.389531960045081
      }
    },
    "risk": {
    "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
    "rugged": false,
    "risks": [],
    "score": 0,
    "jupiterVerified": true
    }
    "buys":0,
    "sells":0,
    "txns":0,
    "holders":651269
    }

---

#### `GET /tokens/by-pool/{poolAddress}`

Retrieves token information by searching with a pool address.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/by-pool/{poolAddress})

Response
    
    
    {
    "token":{
      "name":"OFFICIAL TRUMP",
      "symbol":"TRUMP",
      "mint":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      "uri":"https://arweave.net/cSCP0h2n1crjeSWE9KF-XtLciJalDNFs7Vf-Sm0NNY0",
      "decimals":6,
      "description":"",
      "image":"https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
      "hasFileMetaData":true,
      "strictSocials":{
     
      },
      "creation":{
         "creator":"9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
         "created_tx":"5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
         "created_time":1749298225
      }
    },
    "pools":[
      {
         "poolId":"9d9mb8kooFfaD3SctgZtkxQypkshx6ezhbKio89ixyy2",
         "liquidity":{
            "quote":244375150.385549,
            "usd":360839586.0302158
         },
         "price":{
            "quote":9.966770767653129,
            "usd":9.966770767653129
         },
         "tokenSupply":999999453.314508,
         "lpBurn":0,
         "tokenAddress":"6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
         "marketCap":{
            "quote":9966765318.964148,
            "usd":9966765318.964148
         },
         "market":"meteora-dlmm",
         "quoteToken":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
         "decimals":6,
         "security":{
            "freezeAuthority":null,
            "mintAuthority":null
         },
         "lastUpdated":1743276314161,
         "deployer":"FbMxP3GVq8TQ36nbYgx4NP9iygMpwAwFWJwW81ioCiSF",
         "txns":{
            "buys":96998,
            "total":190413,
            "volume":526726502,
            "volume24h":1726502,
            "sells":93414
         }
      }
    ],
    "events":{
      "1m":{
         "priceChangePercentage":0
      },
      "5m":{
         "priceChangePercentage":-0.4975124378109433
      },
      "15m":{
         "priceChangePercentage":-0.9925496893641157
      },
      "30m":{
         "priceChangePercentage":-0.9925496893641157
      },
      "1h":{
         "priceChangePercentage":0.4999999999999992
      },
      "2h":{
         "priceChangePercentage":1.0025000000000053
      },
      "3h":{
         "priceChangePercentage":-1.485124069019019
      },
      "4h":{
         "priceChangePercentage":-1.485124069019019
      },
      "5h":{
         "priceChangePercentage":-1.485124069019019
      },
      "6h":{
         "priceChangePercentage":-2.462933164049435
      },
      "12h":{
         "priceChangePercentage":-3.4310370179445404
      },
      "24h":{
         "priceChangePercentage":-4.389531960045081
      }
    },
    "risk": {
    "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
    "rugged": false,
    "risks": [],
    "score": 0,
    "jupiterVerified": true
    }
    "buys":0,
    "sells":0,
    "txns":0,
    "holders":651269
    }

---

### GET /tokens/{tokenAddress}/holders - Get Token Holders

#### `GET /tokens/{tokenAddress}/holders`

Gets the top 100 holders for a specific token and the total amount

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress}/holders)

Response
    
    
     
    {
    "total":651343,
    "accounts":[
    {
    "wallet":"2RH6rUTPBJ9rUDPpuV9b8z1YL56k1tYU6Uk5ZoaEFFSK",
    "amount":800000022.564,
    "value":{
    "quote":8134085180.01063,
    "usd":8134085180.01063
    },
    "percentage":80.00004595161334
    },
    {
    "wallet":"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "amount":25151426.025001,
    "value":{
    "quote":255729794.894759,
    "usd":255729794.894759
    },
    "percentage":2.5151439762462187
    },
    {
    "wallet":"C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo",
    "amount":15978104.518764,
    "value":{
    "quote":162459074.3812657,
    "usd":162459074.3812657
    },
    "percentage":1.5978113245847323
    },
    {...}
    ],
    }

---

#### `GET /tokens/{tokenAddress}/holders`

Gets the top 100 holders for a specific token and the total amount

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress}/holders)

Response
    
    
     
    {
    "total":651343,
    "accounts":[
    {
    "wallet":"2RH6rUTPBJ9rUDPpuV9b8z1YL56k1tYU6Uk5ZoaEFFSK",
    "amount":800000022.564,
    "value":{
    "quote":8134085180.01063,
    "usd":8134085180.01063
    },
    "percentage":80.00004595161334
    },
    {
    "wallet":"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "amount":25151426.025001,
    "value":{
    "quote":255729794.894759,
    "usd":255729794.894759
    },
    "percentage":2.5151439762462187
    },
    {
    "wallet":"C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo",
    "amount":15978104.518764,
    "value":{
    "quote":162459074.3812657,
    "usd":162459074.3812657
    },
    "percentage":1.5978113245847323
    },
    {...}
    ],
    }

---

### GET /tokens/{tokenAddress}/holders/top - Get Top 20 Token Holders

#### `GET /tokens/{tokenAddress}/holders/top`

Gets the top 20 holders for a token.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress}/holders/top)

Response
    
    
    [
      {
        "address": "FwbBBzAfBgGaAWjEG4nprZQ8mp8w2W3eHLxAWbyUnwXR",
        "amount": 114837224.78981262,
        "percentage": 12.897608531935292,
        "value": {
          "quote": 364.490083024,
          "usd": 80016.91106116588
        }
      },
      {
        "address": "Cst5bqk7QJAj1tR7qH9eiYnT7ygDEashKYTFvV1obRGK",
        "amount": 27748733.327190395,
        "percentage": 3.116518187950125,
        "value": {
          "quote": 88.07368980529128,
          "usd": 19334.914534601114
        }
      }
    ]

**Developer Tip:** Want to get all token holders? Use this example with your RPC:
    
    
    const tokenAccounts = await connection.getParsedProgramAccounts(
      new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      {
        filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mintAddress } }],
      }
    );
     
    const accounts = tokenAccounts.map((account) => ({
      wallet: account.account.data.parsed.info.owner,
      amount: account.account.data.parsed.info.tokenAmount.uiAmount,
    }));

---

#### `GET /tokens/{tokenAddress}/holders/top`

Gets the top 20 holders for a token.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress}/holders/top)

Response
    
    
    [
      {
        "address": "FwbBBzAfBgGaAWjEG4nprZQ8mp8w2W3eHLxAWbyUnwXR",
        "amount": 114837224.78981262,
        "percentage": 12.897608531935292,
        "value": {
          "quote": 364.490083024,
          "usd": 80016.91106116588
        }
      },
      {
        "address": "Cst5bqk7QJAj1tR7qH9eiYnT7ygDEashKYTFvV1obRGK",
        "amount": 27748733.327190395,
        "percentage": 3.116518187950125,
        "value": {
          "quote": 88.07368980529128,
          "usd": 19334.914534601114
        }
      }
    ]

**Developer Tip:** Want to get all token holders? Use this example with your RPC:
    
    
    const tokenAccounts = await connection.getParsedProgramAccounts(
      new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      {
        filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mintAddress } }],
      }
    );
     
    const accounts = tokenAccounts.map((account) => ({
      wallet: account.account.data.parsed.info.owner,
      amount: account.account.data.parsed.info.tokenAmount.uiAmount,
    }));

---

### GET /tokens/{tokenAddress}/ath - Get All-Time High Price

#### `GET /tokens/{tokenAddress}/ath`

Retrieves the all-time high price of a token (since the data API started recording).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress}/ath)

Response
    
    
    {
      "highest_price": 0.002399892080590551,
      "timestamp": 171924662484
    }

---

#### `GET /tokens/{tokenAddress}/ath`

Retrieves the all-time high price of a token (since the data API started recording).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/{tokenAddress}/ath)

Response
    
    
    {
      "highest_price": 0.002399892080590551,
      "timestamp": 171924662484
    }

---

### GET /deployer/{wallet} - Get Tokens by Deployer

#### `GET /deployer/{wallet}`

Retrieves all tokens created by a specific wallet with pagination support.

Query Parameters

  * `page` (optional): Page number (default: 1)
  * `limit` (optional): Number of items per page (default: 250, max: 500)



### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/deployer/{wallet})

Response
    
    
    {
    "total": 2,
    "tokens": [
    {
      "name": "OFFICIAL TRUMP",
      "symbol": "TRUMP",
      "mint": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
      "decimals": 6,
      "hasSocials": false,
      "poolAddress": "7noYm8BxkbFhe3R37qfaE6vfzoJN4ZhQoWwcLpJPdZyw",
      "liquidityUsd": 534.4163492557315,
      "marketCapUsd": 0,
      "priceUsd": 0,
      "lpBurn": 0,
      "market": "meteora-dlmm",
      "freezeAuthority": null,
      "mintAuthority": null,
      "createdAt": 0,
      "lastUpdated": 1741634697371,
      "buys": 0,
      "sells": 0,
      "totalTransactions": 0
    },
    {
      "name": "DUNA",
      "symbol": "DUNA",
      "mint": "9umkdJdE555ZFMyYbi1AXK2VC2Ge6qUwuLH6bwXPpump",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmPxDiTa5SogsT8SsF5Zq3wKaf6HrcDBbbTuKzALQFQPNg",
      "decimals": 6,
      "hasSocials": false,
      "poolAddress": "DyVWcQE7vhPXa6TPoC9DRB7dZLimoSKYSYezW1W4wJD6",
      "liquidityUsd": 0,
      "marketCapUsd": 0,
      "priceUsd": 0,
      "lpBurn": 0,
      "market": "meteora-dlmm",
      "freezeAuthority": null,
      "mintAuthority": null,
      "createdAt": 0,
      "lastUpdated": 1741650596208,
      "buys": 0,
      "sells": 0,
      "totalTransactions": 0
    }
    ]
    }

---

#### `GET /deployer/{wallet}`

Retrieves all tokens created by a specific wallet with pagination support.

Query Parameters

  * `page` (optional): Page number (default: 1)
  * `limit` (optional): Number of items per page (default: 250, max: 500)



### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/deployer/{wallet})

Response
    
    
    {
    "total": 2,
    "tokens": [
    {
      "name": "OFFICIAL TRUMP",
      "symbol": "TRUMP",
      "mint": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
      "decimals": 6,
      "hasSocials": false,
      "poolAddress": "7noYm8BxkbFhe3R37qfaE6vfzoJN4ZhQoWwcLpJPdZyw",
      "liquidityUsd": 534.4163492557315,
      "marketCapUsd": 0,
      "priceUsd": 0,
      "lpBurn": 0,
      "market": "meteora-dlmm",
      "freezeAuthority": null,
      "mintAuthority": null,
      "createdAt": 0,
      "lastUpdated": 1741634697371,
      "buys": 0,
      "sells": 0,
      "totalTransactions": 0
    },
    {
      "name": "DUNA",
      "symbol": "DUNA",
      "mint": "9umkdJdE555ZFMyYbi1AXK2VC2Ge6qUwuLH6bwXPpump",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmPxDiTa5SogsT8SsF5Zq3wKaf6HrcDBbbTuKzALQFQPNg",
      "decimals": 6,
      "hasSocials": false,
      "poolAddress": "DyVWcQE7vhPXa6TPoC9DRB7dZLimoSKYSYezW1W4wJD6",
      "liquidityUsd": 0,
      "marketCapUsd": 0,
      "priceUsd": 0,
      "lpBurn": 0,
      "market": "meteora-dlmm",
      "freezeAuthority": null,
      "mintAuthority": null,
      "createdAt": 0,
      "lastUpdated": 1741650596208,
      "buys": 0,
      "sells": 0,
      "totalTransactions": 0
    }
    ]
    }

---

### GET /search - Advanced Token Search

#### `GET /search`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/search)

The `/search` endpoint provides a flexible search interface for pools and tokens with comprehensive filtering options and pagination.

Query Parameters

Search & PaginationCreation FiltersLiquidity & Market Cap FiltersVolume FiltersTransaction FiltersToken CharacteristicsAdditional Options

Parameter| Type| Default| Description  
---|---|---|---  
`query`| string| optional| Search term for token symbol, name, or address  
`symbol`| string| optional| Search for all tokens matching an exact symbol  
`page`| integer| 1| Page number for pagination  
`limit`| integer| 100| Number of results per page  
`sortBy`| string| createdAt| Field to sort by  
`sortOrder`| string| desc| Sort order: asc or desc  
`showAllPools`| boolean| false| Return all pools for a token if enabled  
  
Response
    
    
    {
    "status": "success",
    "data": [
    {
      "name": "OFFICIAL TRUMP",
      "symbol": "TRUMP",
      "mint": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      "decimals": 6,
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
      "holders": 651267,
      "jupiter": true,
      "verified": true,
      "liquidityUsd": 360839586.0312104,
      "marketCapUsd": 9966765318.964148,
      "priceUsd": 9.966770767653129,
      "lpBurn": 0,
      "market": "meteora-dlmm",
      "freezeAuthority": null,
      "mintAuthority": null,
      "poolAddress": "9d9mb8kooFfaD3SctgZtkxQypkshx6ezhbKio89ixyy2",
      "totalBuys": 96999,
      "totalSells": 93415,
      "totalTransactions": 190414,
      "volume_5m": 0,
      "volume": 1053453008.146068,
      "volume_15m": 59157,
      "volume_30m": 514425,
      "volume_1h": 777545,
      "volume_6h": 6025120,
      "volume_12h": 11831342,
      "volume_24h": 14501603,
      "tokenDetails": {
        "creator": "HArYFfZtxEA6peDZkvrC68RY6wZ1PyLGrg8y55nRWupy",
        "tx": "3frR9DTRSVpxtKhey8cqF928jwbEH71rBAYjtziqY6MpE3SzQrnRv6xTbjQZpTEHrzzz9upJcDgTNE2Vp4KzMEuz",
        "time": 1745532570
      }
    }
    ]
    }

---

#### `GET /search`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/search)

The `/search` endpoint provides a flexible search interface for pools and tokens with comprehensive filtering options and pagination.

Query Parameters

Search & PaginationCreation FiltersLiquidity & Market Cap FiltersVolume FiltersTransaction FiltersToken CharacteristicsAdditional Options

Parameter| Type| Default| Description  
---|---|---|---  
`query`| string| optional| Search term for token symbol, name, or address  
`symbol`| string| optional| Search for all tokens matching an exact symbol  
`page`| integer| 1| Page number for pagination  
`limit`| integer| 100| Number of results per page  
`sortBy`| string| createdAt| Field to sort by  
`sortOrder`| string| desc| Sort order: asc or desc  
`showAllPools`| boolean| false| Return all pools for a token if enabled  
  
Response
    
    
    {
    "status": "success",
    "data": [
    {
      "name": "OFFICIAL TRUMP",
      "symbol": "TRUMP",
      "mint": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      "decimals": 6,
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Farweave.net%2FVQrPjACwnQRmxdKBTqNwPiyo65x7LAT773t8Kd7YBzw",
      "holders": 651267,
      "jupiter": true,
      "verified": true,
      "liquidityUsd": 360839586.0312104,
      "marketCapUsd": 9966765318.964148,
      "priceUsd": 9.966770767653129,
      "lpBurn": 0,
      "market": "meteora-dlmm",
      "freezeAuthority": null,
      "mintAuthority": null,
      "poolAddress": "9d9mb8kooFfaD3SctgZtkxQypkshx6ezhbKio89ixyy2",
      "totalBuys": 96999,
      "totalSells": 93415,
      "totalTransactions": 190414,
      "volume_5m": 0,
      "volume": 1053453008.146068,
      "volume_15m": 59157,
      "volume_30m": 514425,
      "volume_1h": 777545,
      "volume_6h": 6025120,
      "volume_12h": 11831342,
      "volume_24h": 14501603,
      "tokenDetails": {
        "creator": "HArYFfZtxEA6peDZkvrC68RY6wZ1PyLGrg8y55nRWupy",
        "tx": "3frR9DTRSVpxtKhey8cqF928jwbEH71rBAYjtziqY6MpE3SzQrnRv6xTbjQZpTEHrzzz9upJcDgTNE2Vp4KzMEuz",
        "time": 1745532570
      }
    }
    ]
    }

---

### GET /tokens/latest - Get Latest Tokens

#### `GET /tokens/latest`

Retrieves the latest 100 tokens.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/latest)

Query Parameters

`page` (optional): Page number (1-10)

Response
    
    
    [
    {
    "token": {
      "name": "April Fool’s Day",
      "symbol": "FOOLS",
      "mint": "DWKaYT4omXcZeDiaAUoJfBMhDK7DDQTymusKohsGpump",
      "uri": "https://ipfs.io/ipfs/QmWR8ah9MmciD3ErUJDb9csfRoyFHTT5Lves2zSnqXPeYz",
      "decimals": 6,
      "hasFileMetaData": true,
      "createdOn": "https://pump.fun",
      "description": "It’s a celebration!",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fimage.solanatracker.io%2Fproxy%3Furl%3Dhttps%253A%252F%252Fipfs.io%252Fipfs%252FQmbBVm7CffYX2wnuCrGLARgQHAoX79E4m1HWN2AcBqGYqa",
      "showName": true,
      "twitter": "https://twitter.com/aprilfoolsday",
      "telegram": "https://t.me/aprilsfoolsday",
      "strictSocials": {
        "twitter": "https://twitter.com/aprilfoolsday",
        "telegram": "https://t.me/aprilsfoolsday"
      },
      "creation": {
      "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
      "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
      "created_time": 1749298225
    }
    },
    "pools": [],
    "events": {},
    "risk": {
    "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
    "rugged": false,
    "risks": [],
    "score": 0,
    "jupiterVerified": true
    }
    "buys": 3,
    "sells": 0,
    "txns": 3
    },
    {
    "token": {
      "name": "KWGPOK",
      "symbol": "OKGWP",
      "mint": "7HKHmpYMVtwMqwLrH5529q26v8grmUmWscmww97pump",
      "uri": "https://ipfs.io/ipfs/QmTBkpB8t7R5R9aR2tcJxAM4PM3R6XB9VZ2jE2i1wQR5ar",
      "decimals": 6,
      "hasFileMetaData": true,
      "createdOn": "https://pump.fun",
      "description": "POGWSE",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fimage.solanatracker.io%2Fproxy%3Furl%3Dhttps%253A%252F%252Fipfs.io%252Fipfs%252FQmRDA43fShZSVCE73wSbKemivVPYqWhW222n5roH8c987w",
      "showName": true,
      "strictSocials": {},
      "creation": {
        "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
        "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
        "created_time": 1749298225
      }
    },
    "pools": [
      {
        "poolId": "7HKHmpYMVtwMqwLrH5529q26v8grmUmWscmww97pump",
        "liquidity": {
          "quote": 60.200984914,
          "usd": 7504.35662608982
        },
        "price": {
          "quote": 2.814661839287826e-8,
          "usd": 0.000003508618049029575
        },
        "tokenSupply": 1000000000,
        "lpBurn": 100,
        "tokenAddress": "7HKHmpYMVtwMqwLrH5529q26v8grmUmWscmww97pump",
        "marketCap": {
          "quote": 28.14661839287826,
          "usd": 3508.618049029575
        },
        "decimals": 6,
        "security": {
          "freezeAuthority": null,
          "mintAuthority": null
        },
        "quoteToken": "So11111111111111111111111111111111111111112",
        "market": "pumpfun",
        "curvePercentage": 0.45168079312482234,
        "curve": "Hf4ak2796LJu4nYFUyVAmXV7bxiSvLw3Ayq5C4PFDJWk",
        "deployer": "6hepaQw3pugEBnwY2JBuYGoE5kZjho4DCSHAUKZhcoe",
        "lastUpdated": 1743276573362,
        "createdAt": 1743276571192,
        "txns": {
          "buys": 2,
          "total": 4,
          "volume": 251,
          "volume24h": 251,
          "sells": 1
        }
      }
    ],
    "events": {
      "1m": {
        "priceChangePercentage": 0
      },
      "5m": {
        "priceChangePercentage": 0
      },
      "15m": {
        "priceChangePercentage": 0
      },
      "30m": {
        "priceChangePercentage": 0
      },
      "1h": {
        "priceChangePercentage": 0
      },
      "2h": {
        "priceChangePercentage": 0
      },
      "3h": {
        "priceChangePercentage": 0
      },
      "4h": {
        "priceChangePercentage": 0
      },
      "5h": {
        "priceChangePercentage": 0
      },
      "6h": {
        "priceChangePercentage": 0
      },
      "12h": {
        "priceChangePercentage": 0
      },
      "24h": {
        "priceChangePercentage": 0
      }
    },
    "risk": {
      "rugged": false,
       "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
      "risks": [
        {
          "name": "No social media",
          "description": "This token has no social media links",
          "level": "warning",
          "score": 2000
        },
        {
          "name": "Pump.fun contracts can be changed at any time",
          "description": "Pump.fun contracts can be changed by Pump.fun at any time",
          "level": "warning",
          "score": 10
        },
        {
          "name": "Bonding curve not complete",
          "description": "No raydium liquidity pool, bonding curve not complete",
          "level": "warning",
          "score": 4000
        }
      ],
      "score": 5
    },
    "buys": 3,
    "sells": 1,
    "txns": 4
    }
    ]

---

#### `GET /tokens/latest`

Retrieves the latest 100 tokens.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/latest)

Query Parameters

`page` (optional): Page number (1-10)

Response
    
    
    [
    {
    "token": {
      "name": "April Fool’s Day",
      "symbol": "FOOLS",
      "mint": "DWKaYT4omXcZeDiaAUoJfBMhDK7DDQTymusKohsGpump",
      "uri": "https://ipfs.io/ipfs/QmWR8ah9MmciD3ErUJDb9csfRoyFHTT5Lves2zSnqXPeYz",
      "decimals": 6,
      "hasFileMetaData": true,
      "createdOn": "https://pump.fun",
      "description": "It’s a celebration!",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fimage.solanatracker.io%2Fproxy%3Furl%3Dhttps%253A%252F%252Fipfs.io%252Fipfs%252FQmbBVm7CffYX2wnuCrGLARgQHAoX79E4m1HWN2AcBqGYqa",
      "showName": true,
      "twitter": "https://twitter.com/aprilfoolsday",
      "telegram": "https://t.me/aprilsfoolsday",
      "strictSocials": {
        "twitter": "https://twitter.com/aprilfoolsday",
        "telegram": "https://t.me/aprilsfoolsday"
      },
      "creation": {
      "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
      "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
      "created_time": 1749298225
    }
    },
    "pools": [],
    "events": {},
    "risk": {
    "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
    "rugged": false,
    "risks": [],
    "score": 0,
    "jupiterVerified": true
    }
    "buys": 3,
    "sells": 0,
    "txns": 3
    },
    {
    "token": {
      "name": "KWGPOK",
      "symbol": "OKGWP",
      "mint": "7HKHmpYMVtwMqwLrH5529q26v8grmUmWscmww97pump",
      "uri": "https://ipfs.io/ipfs/QmTBkpB8t7R5R9aR2tcJxAM4PM3R6XB9VZ2jE2i1wQR5ar",
      "decimals": 6,
      "hasFileMetaData": true,
      "createdOn": "https://pump.fun",
      "description": "POGWSE",
      "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fimage.solanatracker.io%2Fproxy%3Furl%3Dhttps%253A%252F%252Fipfs.io%252Fipfs%252FQmRDA43fShZSVCE73wSbKemivVPYqWhW222n5roH8c987w",
      "showName": true,
      "strictSocials": {},
      "creation": {
        "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
        "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
        "created_time": 1749298225
      }
    },
    "pools": [
      {
        "poolId": "7HKHmpYMVtwMqwLrH5529q26v8grmUmWscmww97pump",
        "liquidity": {
          "quote": 60.200984914,
          "usd": 7504.35662608982
        },
        "price": {
          "quote": 2.814661839287826e-8,
          "usd": 0.000003508618049029575
        },
        "tokenSupply": 1000000000,
        "lpBurn": 100,
        "tokenAddress": "7HKHmpYMVtwMqwLrH5529q26v8grmUmWscmww97pump",
        "marketCap": {
          "quote": 28.14661839287826,
          "usd": 3508.618049029575
        },
        "decimals": 6,
        "security": {
          "freezeAuthority": null,
          "mintAuthority": null
        },
        "quoteToken": "So11111111111111111111111111111111111111112",
        "market": "pumpfun",
        "curvePercentage": 0.45168079312482234,
        "curve": "Hf4ak2796LJu4nYFUyVAmXV7bxiSvLw3Ayq5C4PFDJWk",
        "deployer": "6hepaQw3pugEBnwY2JBuYGoE5kZjho4DCSHAUKZhcoe",
        "lastUpdated": 1743276573362,
        "createdAt": 1743276571192,
        "txns": {
          "buys": 2,
          "total": 4,
          "volume": 251,
          "volume24h": 251,
          "sells": 1
        }
      }
    ],
    "events": {
      "1m": {
        "priceChangePercentage": 0
      },
      "5m": {
        "priceChangePercentage": 0
      },
      "15m": {
        "priceChangePercentage": 0
      },
      "30m": {
        "priceChangePercentage": 0
      },
      "1h": {
        "priceChangePercentage": 0
      },
      "2h": {
        "priceChangePercentage": 0
      },
      "3h": {
        "priceChangePercentage": 0
      },
      "4h": {
        "priceChangePercentage": 0
      },
      "5h": {
        "priceChangePercentage": 0
      },
      "6h": {
        "priceChangePercentage": 0
      },
      "12h": {
        "priceChangePercentage": 0
      },
      "24h": {
        "priceChangePercentage": 0
      }
    },
    "risk": {
      "rugged": false,
       "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
      "risks": [
        {
          "name": "No social media",
          "description": "This token has no social media links",
          "level": "warning",
          "score": 2000
        },
        {
          "name": "Pump.fun contracts can be changed at any time",
          "description": "Pump.fun contracts can be changed by Pump.fun at any time",
          "level": "warning",
          "score": 10
        },
        {
          "name": "Bonding curve not complete",
          "description": "No raydium liquidity pool, bonding curve not complete",
          "level": "warning",
          "score": 4000
        }
      ],
      "score": 5
    },
    "buys": 3,
    "sells": 1,
    "txns": 4
    }
    ]

---

### POST /tokens/multi - Get Multiple Tokens

#### `POST /tokens/multi`

Accepts an array of token addresses in the request body (up to 20 per request).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/multi)

Request Body
    
    
    {
      "tokens": [
        "So11111111111111111111111111111111111111112",
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
      ]
    }

---

#### `POST /tokens/multi`

Accepts an array of token addresses in the request body (up to 20 per request).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/multi)

Request Body
    
    
    {
      "tokens": [
        "So11111111111111111111111111111111111111112",
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
      ]
    }

---

### GET /tokens/trending - Get Trending Tokens

#### `GET /tokens/trending`

#### `GET /tokens/trending/{timeframe}`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/trending)

Gets the top 100 trending tokens based on transaction volume in the specified timeframe (default: past hour).

Available Timeframes

`5m`, `15m`, `30m`, `1h` (default), `2h`, `3h`, `4h`, `5h`, `6h`, `12h`, `24h`

---

#### `GET /tokens/trending`

#### `GET /tokens/trending/{timeframe}`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/trending)

Gets the top 100 trending tokens based on transaction volume in the specified timeframe (default: past hour).

Available Timeframes

`5m`, `15m`, `30m`, `1h` (default), `2h`, `3h`, `4h`, `5h`, `6h`, `12h`, `24h`

---

#### `GET /tokens/trending/{timeframe}`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/trending)

Gets the top 100 trending tokens based on transaction volume in the specified timeframe (default: past hour).

Available Timeframes

`5m`, `15m`, `30m`, `1h` (default), `2h`, `3h`, `4h`, `5h`, `6h`, `12h`, `24h`

---

### GET /tokens/volume - Get Tokens by Volume

#### `GET /tokens/volume`

#### `GET /tokens/volume/{timeframe}`

Retrieves the top 100 tokens sorted by highest volume within the specified timeframe.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/volume)

Available Timeframes

`5m`, `15m`, `30m`, `1h`, `6h`, `12h`, `24h`

---

#### `GET /tokens/volume`

#### `GET /tokens/volume/{timeframe}`

Retrieves the top 100 tokens sorted by highest volume within the specified timeframe.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/volume)

Available Timeframes

`5m`, `15m`, `30m`, `1h`, `6h`, `12h`, `24h`

---

#### `GET /tokens/volume/{timeframe}`

Retrieves the top 100 tokens sorted by highest volume within the specified timeframe.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/volume)

Available Timeframes

`5m`, `15m`, `30m`, `1h`, `6h`, `12h`, `24h`

---

### GET /tokens/multi/all - Get Token Overview

#### `GET /tokens/multi/all`

Gets an overview of latest, graduating, and graduated tokens (Pumpvision / Photon Memescope style).

Query Parameters

  * `limit` (optional): Number of tokens per category (latest, graduating, graduated)



### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/multi/all)

Response
    
    
    {
    "latest": [
    {
      "token": {
        "name": "Cult of Trenching",
        "symbol": "TrenchCult",
        "mint": "uwjFzyPjn8ayhfVfeMUzkQBbrgeFMeEd47NvRbCpump",
        "uri": "https://ipfs.io/ipfs/QmWT5HsQh5oLvnqthDgQEGVUjn3gH9R6PyhJNr4wkdsn66",
        "decimals": 6,
        "hasFileMetaData": true,
        "createdOn": "https://pump.fun",
        "description": "",
        "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fimage.solanatracker.io%2Fproxy%3Furl%3Dhttps%253A%252F%252Fipfs.io%252Fipfs%252FQmXWHqMvrqkubp6kxw9vUcNPv42ZXQ3BLcCARXjUoWLsAg",
        "showName": true,
        "twitter": "https://x.com/solgoated1/status/1906065859657032002",
        "website": "https://x.com/solgoated1/status/1906065859657032002",
        "strictSocials": {
          "twitter": "https://x.com/solgoated1/status/1906065859657032002"
        }
      },
      "pools": [
        {
          "poolId": "uwjFzyPjn8ayhfVfeMUzkQBbrgeFMeEd47NvRbCpump",
          "liquidity": {
            "quote": 74.997144066,
            "usd": 9366.628111886268
          },
          "price": {
            "quote": 4.3682600325215646e-8,
            "usd": 0.0000054556567093592755
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "uwjFzyPjn8ayhfVfeMUzkQBbrgeFMeEd47NvRbCpump",
          "marketCap": {
            "quote": 43.682600325215645,
            "usd": 5455.656709359276
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun",
          "curvePercentage": 27.05425691727814,
          "curve": "7ofQyZf2HmYCmM4LWHNaP9VEZ2frevtwmEdtjBb2hwgh",
          "deployer": "6Y5FiURYwKGXBPAes1P9WDGuHoi8oiz4FwYWyHeYNXPw",
          "lastUpdated": 1743276647681,
          "createdAt": 1743276646913,
          "txns": {
            "buys": 3,
            "total": 3,
            "volume": 490,
            "volume24h": 490,
            "sells": 0
          }
        }
      ],
      "events": {
        "1m": {
          "priceChangePercentage": 0
        },
        "5m": {
          "priceChangePercentage": 0
        },
        "15m": {
          "priceChangePercentage": 0
        },
        "30m": {
          "priceChangePercentage": 0
        },
        "1h": {
          "priceChangePercentage": 0
        },
        "2h": {
          "priceChangePercentage": 0
        },
        "3h": {
          "priceChangePercentage": 0
        },
        "4h": {
          "priceChangePercentage": 0
        },
        "5h": {
          "priceChangePercentage": 0
        },
        "6h": {
          "priceChangePercentage": 0
        },
        "12h": {
          "priceChangePercentage": 0
        },
        "24h": {
          "priceChangePercentage": 0
        }
      },
      "risk": {
         "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
        "rugged": false,
        "risks": [
          {
            "name": "Pump.fun contracts can be changed at any time",
            "description": "Pump.fun contracts can be changed by Pump.fun at any time",
            "level": "warning",
            "score": 10
          },
          {
            "name": "Bonding curve not complete",
            "description": "No raydium liquidity pool, bonding curve not complete",
            "level": "warning",
            "score": 4000
          }
        ],
        "score": 3
      },
      "buys": 2,
      "sells": 0,
      "txns": 2
    }
    ],
    "graduating": [
    {
      "token": {
        "name": "White Grandpa",
        "symbol": "UNC",
        "mint": "6wX5EfAx9gGHLQ2Z21N8CaLorGav8EFDdrTzyq1pump",
        "uri": "https://ipfs.io/ipfs/QmPX3mqev2udUJLVNFHTxY8gTSodDbfbQrYoQvAWq9FVsT",
        "decimals": 6,
        "hasFileMetaData": true,
        "createdOn": "https://pump.fun",
        "description": "stay woke\r\nhttps://x.com/DailyLoud/status/1905634722543251595",
        "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fipfs-forward.solanatracker.io%2Fipfs%2FQmRY15KCq65MMgECXWbnAivuDcHV7t7gKXHRpb2qCQbeGM",
        "showName": true,
        "twitter": "https://x.com/DailyLoud/status/1905634722543251595",
        "strictSocials": {
          "twitter": "https://x.com/DailyLoud/status/1905634722543251595"
        },
        "creation": {
          "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
          "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
          "created_time": 1749298225
        }
      },
      "pools": [
        {
          "poolId": "6wX5EfAx9gGHLQ2Z21N8CaLorGav8EFDdrTzyq1pump",
          "liquidity": {
            "quote": 184.205822434,
            "usd": 23006.041846940676
          },
          "price": {
            "quote": 2.635273705842488e-7,
            "usd": 0.00003291275832308565
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "6wX5EfAx9gGHLQ2Z21N8CaLorGav8EFDdrTzyq1pump",
          "marketCap": {
            "quote": 263.5273705842488,
            "usd": 32912.75832308565
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun",
          "curvePercentage": 91.22426412249791,
          "curve": "B8UVQ46EqQ2sEHagX7h1WzDpxuFVXp6fAjiXFaT1D692",
          "deployer": "4VfBaC9Jftw4Bm1oHYt8TrhamF7DGEr9Ut2JovCPWbqe",
          "lastUpdated": 1743276647759,
          "createdAt": 1743274179758,
          "txns": {
            "buys": 977,
            "total": 1866,
            "volume": 31100,
            "volume24h": 31100,
            "sells": 889
          },
          "bundleId": "e88d7ab51773355bad96ac842f0976231bd87083d77882f56c62a277c840fcb8"
        }
      ],
      "events": {
        "1m": {
          "priceChangePercentage": -4.1724840124786216
        },
        "5m": {
          "priceChangePercentage": -0.8171310506410367
        },
        "15m": {
          "priceChangePercentage": 46.42260473798215
        },
        "30m": {
          "priceChangePercentage": 54.14793685627088
        },
        "1h": {
          "priceChangePercentage": 868.7250909621494
        },
        "2h": {
          "priceChangePercentage": 868.7250909621494
        },
        "3h": {
          "priceChangePercentage": 868.7250909621494
        },
        "4h": {
          "priceChangePercentage": 868.7250909621494
        },
        "5h": {
          "priceChangePercentage": 868.7250909621494
        },
        "6h": {
          "priceChangePercentage": 868.7250909621494
        },
        "12h": {
          "priceChangePercentage": 868.7250909621494
        },
        "24h": {
          "priceChangePercentage": 868.7250909621494
        }
      },
      "risk": {
         "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
        "rugged": false,
        "risks": [
          {
            "name": "Pump.fun contracts can be changed at any time",
            "description": "Pump.fun contracts can be changed by Pump.fun at any time",
            "level": "warning",
            "score": 10
          },
          {
            "name": "Bonding curve not complete",
            "description": "No raydium liquidity pool, bonding curve not complete",
            "level": "warning",
            "score": 4000
          }
        ],
        "score": 3
      },
      "buys": 1182,
      "sells": 1123,
      "txns": 2305,
      "holders": 232
    }
    ],
    "graduated": [
    {
      "token": {
        "name": "X Æ Meow-12",
        "symbol": "XÆMeow-12",
        "mint": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
        "uri": "https://ipfs-forward.solanatracker.io/ipfs/QmZc1ndhGNpywi5YdbiUwWetAumWPCqdyHCDoAN6hVQ7Pb",
        "decimals": 6,
        "description": "",
        "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fipfs-forward.solanatracker.io%2Fipfs%2FQme3Qoomq5sUxx8E7BViGQ5CCs9obGHWfA8C6UrmBscPSS",
        "showName": true,
        "createdOn": "https://pump.fun",
        "twitter": "https://x.com/Josikinz/status/1906060748796867071",
        "hasFileMetaData": true,
        "strictSocials": {
          "twitter": "https://x.com/Josikinz/status/1906060748796867071"
        },
        "creation": {
          "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
          "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
          "created_time": 1749298225
        }
      },
      "pools": [
        {
          "poolId": "5UH61hrcBSgE3fLXQ4bMTtXb7e1bVvSeisJq7z8V8yvE",
          "liquidity": {
            "quote": 18.503268912,
            "usd": 4613.051725397854
          },
          "price": {
            "quote": 1.9289130860019372e-8,
            "usd": 0.0000024044875210544464
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
          "marketCap": {
            "quote": 19.289130860019373,
            "usd": 2404.4875210544465
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun-amm",
          "deployer": "2WDizMKyQaYXJxaZ2oPFGM9kdCZuWhX52oMy57NUESrN",
          "lastUpdated": 1743276422531,
          "txns": {
            "buys": 25,
            "total": 45,
            "volume": 5947,
            "volume24h": 3947,
            "sells": 20
          },
          "bundleId": "5ad775152feacf1be43bdbc82a9c0551a2757cca30bb8bfb15c0d1742692a78e"
        },
        {
          "poolId": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
          "liquidity": {
            "quote": 0,
            "usd": 0
          },
          "price": {
            "quote": null,
            "usd": null
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
          "marketCap": {
            "quote": null,
            "usd": null
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun",
          "curvePercentage": 100,
          "curve": "WLEgumwUg9brqWHZUYPFVpSqAur5Av8ctYkqegtUDJN",
          "deployer": "6d22FozaKK239PoBYVffkYKA1QPQZE8fC7AQkpmHQfjp",
          "lastUpdated": 1743275416731,
          "createdAt": 1743275416459,
          "txns": {
            "buys": 1,
            "total": 1,
            "volume": 5305,
            "volume24h": 4305,
            "sells": 0
          }
        }
      ],
      "events": {
        "1m": {
          "priceChangePercentage": 0
        },
        "5m": {
          "priceChangePercentage": 2.546993067700225
        },
        "15m": {
          "priceChangePercentage": -7.955395053691079
        },
        "30m": {
          "priceChangePercentage": -95.75161080372789
        },
        "1h": {
          "priceChangePercentage": -95.75161080372789
        },
        "2h": {
          "priceChangePercentage": -95.75161080372789
        },
        "3h": {
          "priceChangePercentage": -95.75161080372789
        },
        "4h": {
          "priceChangePercentage": -95.75161080372789
        },
        "5h": {
          "priceChangePercentage": -95.75161080372789
        },
        "6h": {
          "priceChangePercentage": -95.75161080372789
        },
        "12h": {
          "priceChangePercentage": -95.75161080372789
        },
        "24h": {
          "priceChangePercentage": -95.75161080372789
        }
      },
      "risk": {
         "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
        "rugged": false,
        "risks": [
          {
            "name": "Price Decrease",
            "description": "Price decreased by more than 50% in the last 24 hours",
            "level": "warning",
            "score": 1000
          }
        ],
        "score": 1
      },
      "buys": 1,
      "sells": 0,
      "txns": 1,
      "holders": 13
    }
    ]
    }

---

#### `GET /tokens/multi/all`

Gets an overview of latest, graduating, and graduated tokens (Pumpvision / Photon Memescope style).

Query Parameters

  * `limit` (optional): Number of tokens per category (latest, graduating, graduated)



### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/multi/all)

Response
    
    
    {
    "latest": [
    {
      "token": {
        "name": "Cult of Trenching",
        "symbol": "TrenchCult",
        "mint": "uwjFzyPjn8ayhfVfeMUzkQBbrgeFMeEd47NvRbCpump",
        "uri": "https://ipfs.io/ipfs/QmWT5HsQh5oLvnqthDgQEGVUjn3gH9R6PyhJNr4wkdsn66",
        "decimals": 6,
        "hasFileMetaData": true,
        "createdOn": "https://pump.fun",
        "description": "",
        "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fimage.solanatracker.io%2Fproxy%3Furl%3Dhttps%253A%252F%252Fipfs.io%252Fipfs%252FQmXWHqMvrqkubp6kxw9vUcNPv42ZXQ3BLcCARXjUoWLsAg",
        "showName": true,
        "twitter": "https://x.com/solgoated1/status/1906065859657032002",
        "website": "https://x.com/solgoated1/status/1906065859657032002",
        "strictSocials": {
          "twitter": "https://x.com/solgoated1/status/1906065859657032002"
        }
      },
      "pools": [
        {
          "poolId": "uwjFzyPjn8ayhfVfeMUzkQBbrgeFMeEd47NvRbCpump",
          "liquidity": {
            "quote": 74.997144066,
            "usd": 9366.628111886268
          },
          "price": {
            "quote": 4.3682600325215646e-8,
            "usd": 0.0000054556567093592755
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "uwjFzyPjn8ayhfVfeMUzkQBbrgeFMeEd47NvRbCpump",
          "marketCap": {
            "quote": 43.682600325215645,
            "usd": 5455.656709359276
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun",
          "curvePercentage": 27.05425691727814,
          "curve": "7ofQyZf2HmYCmM4LWHNaP9VEZ2frevtwmEdtjBb2hwgh",
          "deployer": "6Y5FiURYwKGXBPAes1P9WDGuHoi8oiz4FwYWyHeYNXPw",
          "lastUpdated": 1743276647681,
          "createdAt": 1743276646913,
          "txns": {
            "buys": 3,
            "total": 3,
            "volume": 490,
            "volume24h": 490,
            "sells": 0
          }
        }
      ],
      "events": {
        "1m": {
          "priceChangePercentage": 0
        },
        "5m": {
          "priceChangePercentage": 0
        },
        "15m": {
          "priceChangePercentage": 0
        },
        "30m": {
          "priceChangePercentage": 0
        },
        "1h": {
          "priceChangePercentage": 0
        },
        "2h": {
          "priceChangePercentage": 0
        },
        "3h": {
          "priceChangePercentage": 0
        },
        "4h": {
          "priceChangePercentage": 0
        },
        "5h": {
          "priceChangePercentage": 0
        },
        "6h": {
          "priceChangePercentage": 0
        },
        "12h": {
          "priceChangePercentage": 0
        },
        "24h": {
          "priceChangePercentage": 0
        }
      },
      "risk": {
         "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
        "rugged": false,
        "risks": [
          {
            "name": "Pump.fun contracts can be changed at any time",
            "description": "Pump.fun contracts can be changed by Pump.fun at any time",
            "level": "warning",
            "score": 10
          },
          {
            "name": "Bonding curve not complete",
            "description": "No raydium liquidity pool, bonding curve not complete",
            "level": "warning",
            "score": 4000
          }
        ],
        "score": 3
      },
      "buys": 2,
      "sells": 0,
      "txns": 2
    }
    ],
    "graduating": [
    {
      "token": {
        "name": "White Grandpa",
        "symbol": "UNC",
        "mint": "6wX5EfAx9gGHLQ2Z21N8CaLorGav8EFDdrTzyq1pump",
        "uri": "https://ipfs.io/ipfs/QmPX3mqev2udUJLVNFHTxY8gTSodDbfbQrYoQvAWq9FVsT",
        "decimals": 6,
        "hasFileMetaData": true,
        "createdOn": "https://pump.fun",
        "description": "stay woke\r\nhttps://x.com/DailyLoud/status/1905634722543251595",
        "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fipfs-forward.solanatracker.io%2Fipfs%2FQmRY15KCq65MMgECXWbnAivuDcHV7t7gKXHRpb2qCQbeGM",
        "showName": true,
        "twitter": "https://x.com/DailyLoud/status/1905634722543251595",
        "strictSocials": {
          "twitter": "https://x.com/DailyLoud/status/1905634722543251595"
        },
        "creation": {
          "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
          "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
          "created_time": 1749298225
        }
      },
      "pools": [
        {
          "poolId": "6wX5EfAx9gGHLQ2Z21N8CaLorGav8EFDdrTzyq1pump",
          "liquidity": {
            "quote": 184.205822434,
            "usd": 23006.041846940676
          },
          "price": {
            "quote": 2.635273705842488e-7,
            "usd": 0.00003291275832308565
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "6wX5EfAx9gGHLQ2Z21N8CaLorGav8EFDdrTzyq1pump",
          "marketCap": {
            "quote": 263.5273705842488,
            "usd": 32912.75832308565
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun",
          "curvePercentage": 91.22426412249791,
          "curve": "B8UVQ46EqQ2sEHagX7h1WzDpxuFVXp6fAjiXFaT1D692",
          "deployer": "4VfBaC9Jftw4Bm1oHYt8TrhamF7DGEr9Ut2JovCPWbqe",
          "lastUpdated": 1743276647759,
          "createdAt": 1743274179758,
          "txns": {
            "buys": 977,
            "total": 1866,
            "volume": 31100,
            "volume24h": 31100,
            "sells": 889
          },
          "bundleId": "e88d7ab51773355bad96ac842f0976231bd87083d77882f56c62a277c840fcb8"
        }
      ],
      "events": {
        "1m": {
          "priceChangePercentage": -4.1724840124786216
        },
        "5m": {
          "priceChangePercentage": -0.8171310506410367
        },
        "15m": {
          "priceChangePercentage": 46.42260473798215
        },
        "30m": {
          "priceChangePercentage": 54.14793685627088
        },
        "1h": {
          "priceChangePercentage": 868.7250909621494
        },
        "2h": {
          "priceChangePercentage": 868.7250909621494
        },
        "3h": {
          "priceChangePercentage": 868.7250909621494
        },
        "4h": {
          "priceChangePercentage": 868.7250909621494
        },
        "5h": {
          "priceChangePercentage": 868.7250909621494
        },
        "6h": {
          "priceChangePercentage": 868.7250909621494
        },
        "12h": {
          "priceChangePercentage": 868.7250909621494
        },
        "24h": {
          "priceChangePercentage": 868.7250909621494
        }
      },
      "risk": {
         "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
        "rugged": false,
        "risks": [
          {
            "name": "Pump.fun contracts can be changed at any time",
            "description": "Pump.fun contracts can be changed by Pump.fun at any time",
            "level": "warning",
            "score": 10
          },
          {
            "name": "Bonding curve not complete",
            "description": "No raydium liquidity pool, bonding curve not complete",
            "level": "warning",
            "score": 4000
          }
        ],
        "score": 3
      },
      "buys": 1182,
      "sells": 1123,
      "txns": 2305,
      "holders": 232
    }
    ],
    "graduated": [
    {
      "token": {
        "name": "X Æ Meow-12",
        "symbol": "XÆMeow-12",
        "mint": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
        "uri": "https://ipfs-forward.solanatracker.io/ipfs/QmZc1ndhGNpywi5YdbiUwWetAumWPCqdyHCDoAN6hVQ7Pb",
        "decimals": 6,
        "description": "",
        "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fipfs-forward.solanatracker.io%2Fipfs%2FQme3Qoomq5sUxx8E7BViGQ5CCs9obGHWfA8C6UrmBscPSS",
        "showName": true,
        "createdOn": "https://pump.fun",
        "twitter": "https://x.com/Josikinz/status/1906060748796867071",
        "hasFileMetaData": true,
        "strictSocials": {
          "twitter": "https://x.com/Josikinz/status/1906060748796867071"
        },
        "creation": {
          "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
          "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
          "created_time": 1749298225
        }
      },
      "pools": [
        {
          "poolId": "5UH61hrcBSgE3fLXQ4bMTtXb7e1bVvSeisJq7z8V8yvE",
          "liquidity": {
            "quote": 18.503268912,
            "usd": 4613.051725397854
          },
          "price": {
            "quote": 1.9289130860019372e-8,
            "usd": 0.0000024044875210544464
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
          "marketCap": {
            "quote": 19.289130860019373,
            "usd": 2404.4875210544465
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun-amm",
          "deployer": "2WDizMKyQaYXJxaZ2oPFGM9kdCZuWhX52oMy57NUESrN",
          "lastUpdated": 1743276422531,
          "txns": {
            "buys": 25,
            "total": 45,
            "volume": 5947,
            "volume24h": 3947,
            "sells": 20
          },
          "bundleId": "5ad775152feacf1be43bdbc82a9c0551a2757cca30bb8bfb15c0d1742692a78e"
        },
        {
          "poolId": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
          "liquidity": {
            "quote": 0,
            "usd": 0
          },
          "price": {
            "quote": null,
            "usd": null
          },
          "tokenSupply": 1000000000,
          "lpBurn": 100,
          "tokenAddress": "UkAivL55R7iBEW3wfsTETdiHM1jfByHTRAFQHiKWLyF",
          "marketCap": {
            "quote": null,
            "usd": null
          },
          "decimals": 6,
          "security": {
            "freezeAuthority": null,
            "mintAuthority": null
          },
          "quoteToken": "So11111111111111111111111111111111111111112",
          "market": "pumpfun",
          "curvePercentage": 100,
          "curve": "WLEgumwUg9brqWHZUYPFVpSqAur5Av8ctYkqegtUDJN",
          "deployer": "6d22FozaKK239PoBYVffkYKA1QPQZE8fC7AQkpmHQfjp",
          "lastUpdated": 1743275416731,
          "createdAt": 1743275416459,
          "txns": {
            "buys": 1,
            "total": 1,
            "volume": 5305,
            "volume24h": 4305,
            "sells": 0
          }
        }
      ],
      "events": {
        "1m": {
          "priceChangePercentage": 0
        },
        "5m": {
          "priceChangePercentage": 2.546993067700225
        },
        "15m": {
          "priceChangePercentage": -7.955395053691079
        },
        "30m": {
          "priceChangePercentage": -95.75161080372789
        },
        "1h": {
          "priceChangePercentage": -95.75161080372789
        },
        "2h": {
          "priceChangePercentage": -95.75161080372789
        },
        "3h": {
          "priceChangePercentage": -95.75161080372789
        },
        "4h": {
          "priceChangePercentage": -95.75161080372789
        },
        "5h": {
          "priceChangePercentage": -95.75161080372789
        },
        "6h": {
          "priceChangePercentage": -95.75161080372789
        },
        "12h": {
          "priceChangePercentage": -95.75161080372789
        },
        "24h": {
          "priceChangePercentage": -95.75161080372789
        }
      },
      "risk": {
         "snipers": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "insiders": {
    "count": 0,
    "totalBalance": 0,
    "totalPercentage": 0,
    "wallets": []
    },
    "top10": 0,
        "rugged": false,
        "risks": [
          {
            "name": "Price Decrease",
            "description": "Price decreased by more than 50% in the last 24 hours",
            "level": "warning",
            "score": 1000
          }
        ],
        "score": 1
      },
      "buys": 1,
      "sells": 0,
      "txns": 1,
      "holders": 13
    }
    ]
    }

---

### GET /tokens/multi/graduated - Get Graduated Tokens

#### `GET /tokens/multi/graduated`

Overview of all graduated pumpfun/moonshot tokens.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/multi/graduated)

---

#### `GET /tokens/multi/graduated`

Overview of all graduated pumpfun/moonshot tokens.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/tokens/multi/graduated)

---

### GET /price - Get Token Price

#### `GET /price`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/price)

Gets price information for a single token.

Query Parameters

  * `token` (required): The token address
  * `priceChanges` (optional): Returns price change percentages up to 24 hours ago



Response
    
    
    {
      "price": 1.23,
      "liquidity": 1000000,
      "marketCap": 50000000,
      "lastUpdated": 1628097600000
    }

---

#### `GET /price`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/price)

Gets price information for a single token.

Query Parameters

  * `token` (required): The token address
  * `priceChanges` (optional): Returns price change percentages up to 24 hours ago



Response
    
    
    {
      "price": 1.23,
      "liquidity": 1000000,
      "marketCap": 50000000,
      "lastUpdated": 1628097600000
    }

---

### GET /price/history - Get Historic Price Information

#### `GET /price/history`

Gets historic price information for a single token.

Query Parameters

`token` (required): The token address

Response
    
    
    {
      "current": 0.00153420295896641,
      "3d": 0.0003172284163334442,
      "5d": 0.00030182128340039925,
      "7d": 0.0003772164702056164,
      "14d": 0.0003333105740474755,
      "30d": 0.0008621030248959815
    }

---

#### `GET /price/history`

Gets historic price information for a single token.

Query Parameters

`token` (required): The token address

Response
    
    
    {
      "current": 0.00153420295896641,
      "3d": 0.0003172284163334442,
      "5d": 0.00030182128340039925,
      "7d": 0.0003772164702056164,
      "14d": 0.0003333105740474755,
      "30d": 0.0008621030248959815
    }

---

### GET /price/history/timestamp - Get Price at Specific Timestamp

#### `GET /price/history/timestamp`

Gets specific historic price information for a token at a given timestamp.

Query Parameters

  * `token` (required): The token address
  * `timestamp` (required): The target timestamp (unix timestamp)



Response
    
    
    {
      "price": 0.0010027648651222173,
      "timestamp": 1732237829688,
      "timestamp_unix": 1732237830,
      "pool": "D5Nbd1N7zAu8zjKoz3yR9WSXTiZr1c1TwRtiHeu5j7iv"
    }

---

#### `GET /price/history/timestamp`

Gets specific historic price information for a token at a given timestamp.

Query Parameters

  * `token` (required): The token address
  * `timestamp` (required): The target timestamp (unix timestamp)



Response
    
    
    {
      "price": 0.0010027648651222173,
      "timestamp": 1732237829688,
      "timestamp_unix": 1732237830,
      "pool": "D5Nbd1N7zAu8zjKoz3yR9WSXTiZr1c1TwRtiHeu5j7iv"
    }

---

### GET /price/history/range - Get lowest and highest price in time range

#### `GET /price/history/range`

Gets the lowest and highest price in a time range

Query Parameters

  * `token` (required): The token address
  * `time_from` (required): Start time (unix timestamp)
  * `time_to` (required): End time (unix timestamp)



Response
    
    
    {
      "token": "HEZ6KcNNUKaWvUCBEe4BtfoeDHEHPkCHY9JaDNqrpump",
      "price": {
          "lowest": {
              "price": 0.000048405946337731886,
              "time": 1740009112
          },
          "highest": {
              "price": 0.003417425506087095,
              "time": 1740216420
          }
      }
    }

---

#### `GET /price/history/range`

Gets the lowest and highest price in a time range

Query Parameters

  * `token` (required): The token address
  * `time_from` (required): Start time (unix timestamp)
  * `time_to` (required): End time (unix timestamp)



Response
    
    
    {
      "token": "HEZ6KcNNUKaWvUCBEe4BtfoeDHEHPkCHY9JaDNqrpump",
      "price": {
          "lowest": {
              "price": 0.000048405946337731886,
              "time": 1740009112
          },
          "highest": {
              "price": 0.003417425506087095,
              "time": 1740216420
          }
      }
    }

---

### POST /price - Post Token Price

#### `POST /price`

Similar to GET /price, but accepts token address in the request body.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/price)

Request Body
    
    
    {
      "token": "So11111111111111111111111111111111111111112"
    }

---

#### `POST /price`

Similar to GET /price, but accepts token address in the request body.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/price)

Request Body
    
    
    {
      "token": "So11111111111111111111111111111111111111112"
    }

---

### GET/POST /price/multi - Get Multiple Token Prices

GETPOST

#### `GET /price/multi`

Gets price information for multiple tokens (up to 100).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/price/multi)

Query Parameters

  * `tokens` (required): Comma-separated list of token addresses
  * `priceChanges` (optional): Returns price change percentages up to 24 hours ago

---

#### `GET /price/multi`

Gets price information for multiple tokens (up to 100).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/price/multi)

Query Parameters

  * `tokens` (required): Comma-separated list of token addresses
  * `priceChanges` (optional): Returns price change percentages up to 24 hours ago

---

### GET /wallet/{owner} - Get Wallet Tokens

#### `GET /wallet/{owner}`

Gets all tokens in a wallet with current value in USD.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner})

Response
    
    
    {
      "tokens": [
        {
          "token": {
            "name": "Wrapped SOL",
            "symbol": "SOL",
            "mint": "So11111111111111111111111111111111111111112",
            "uri": "",
            "decimals": 9,
            "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fcoin-images.coingecko.com%2Fcoins%2Fimages%2F21629%2Flarge%2Fsolana.jpg%3F1696520989",
            "hasFileMetaData": true,
            "creation": {
              "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
              "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
              "created_time": 1749298225
            }
          },
          "pools": [...],
          "events": {...},
          "risk": {...},
          "balance": 0.775167121,
          "value": 112.31297732160377
        }
      ],
      "total": 228.41656975961473,
      "totalSol": 1.5750283296373857,
      "timestamp": "2024-08-15 12:49:06"
    }

---

#### `GET /wallet/{owner}`

Gets all tokens in a wallet with current value in USD.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner})

Response
    
    
    {
      "tokens": [
        {
          "token": {
            "name": "Wrapped SOL",
            "symbol": "SOL",
            "mint": "So11111111111111111111111111111111111111112",
            "uri": "",
            "decimals": 9,
            "image": "https://image.solanatracker.io/proxy?url=https%3A%2F%2Fcoin-images.coingecko.com%2Fcoins%2Fimages%2F21629%2Flarge%2Fsolana.jpg%3F1696520989",
            "hasFileMetaData": true,
            "creation": {
              "creator": "9zGpUxJr2jnkwSSF9VGezy6aALEfxysE19hvcRSkbn15",
              "created_tx": "5eHbuGuF1GfFcBgHcym69A1ErUYzY5vD2tE5hJ4A71yvZ7U3e93xMy1CWeH1HcAiyy6Yi8GDoJjeSXHhuDC4CFnW",
              "created_time": 1749298225
            }
          },
          "pools": [...],
          "events": {...},
          "risk": {...},
          "balance": 0.775167121,
          "value": 112.31297732160377
        }
      ],
      "total": 228.41656975961473,
      "totalSol": 1.5750283296373857,
      "timestamp": "2024-08-15 12:49:06"
    }

---

### GET /wallet/{owner}/basic - Get Basic Wallet Information

#### `GET /wallet/{owner}/basic`

Gets all tokens in a wallet with current value in USD (lightweight, non-cached option).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/basic)

Response
    
    
    {
    "tokens": [
    {
      "address": "So11111111111111111111111111111111111111112",
      "balance": 0.019911506,
      "value": 2.4810073805356456,
      "price": {
        "quote": 1,
        "usd": 124.60169414285619
      },
      "marketCap": {
        "quote": 79833267.86038868,
        "usd": 9953124295.82677
      },
      "liquidity": {
        "quote": 395459.208121804,
        "usd": 49303439.00300889
      }
    },
    {
      "address": "9BT13kNGQFKvSj2BibHPKmpxxSnqMFUEEZEMQ5SNpump",
      "balance": 35145.6526,
      "value": 0.07660938412685546,
      "price": {
        "usd": 0.0000021797684339159336,
        "quote": 1.6913819975765577e-8
      },
      "marketCap": {
        "usd": 2178.6061946025698,
        "quote": 16.904801629500383
      },
      "liquidity": {
        "usd": 4300.296098435483,
        "quote": 33.367963734
      }
    },
    {
      "address": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
      "balance": 0.078177,
      "value": 0.03318780628945246,
      "price": {
        "usd": 0.42452135908838234,
        "quote": 0.0034070271837690056
      },
      "marketCap": {
        "usd": 424029286.2902132,
        "quote": 3403078.017575447
      },
      "liquidity": {
        "usd": 7978691.886756113,
        "quote": 64033.57467683
      }
    },
    {
      "address": "AF7CYuqRw61atGBVT9LpxaXuSW9RuGmfnSAEgaHppump",
      "balance": 2143.21592,
      "value": 0.0075007010716513205,
      "price": {
        "usd": 0.0000034997412074334164,
        "quote": 2.7995661589662763e-8
      },
      "marketCap": {
        "usd": 3499.7412074334165,
        "quote": 27.995661589662763
      },
      "liquidity": {
        "usd": 7505.524527654956,
        "quote": 60.039332132
      }
    }
    ],
    "total": 2.598305272023605,
    "totalSol": 0.02085288879816225
    }

---

#### `GET /wallet/{owner}/basic`

Gets all tokens in a wallet with current value in USD (lightweight, non-cached option).

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/basic)

Response
    
    
    {
    "tokens": [
    {
      "address": "So11111111111111111111111111111111111111112",
      "balance": 0.019911506,
      "value": 2.4810073805356456,
      "price": {
        "quote": 1,
        "usd": 124.60169414285619
      },
      "marketCap": {
        "quote": 79833267.86038868,
        "usd": 9953124295.82677
      },
      "liquidity": {
        "quote": 395459.208121804,
        "usd": 49303439.00300889
      }
    },
    {
      "address": "9BT13kNGQFKvSj2BibHPKmpxxSnqMFUEEZEMQ5SNpump",
      "balance": 35145.6526,
      "value": 0.07660938412685546,
      "price": {
        "usd": 0.0000021797684339159336,
        "quote": 1.6913819975765577e-8
      },
      "marketCap": {
        "usd": 2178.6061946025698,
        "quote": 16.904801629500383
      },
      "liquidity": {
        "usd": 4300.296098435483,
        "quote": 33.367963734
      }
    },
    {
      "address": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
      "balance": 0.078177,
      "value": 0.03318780628945246,
      "price": {
        "usd": 0.42452135908838234,
        "quote": 0.0034070271837690056
      },
      "marketCap": {
        "usd": 424029286.2902132,
        "quote": 3403078.017575447
      },
      "liquidity": {
        "usd": 7978691.886756113,
        "quote": 64033.57467683
      }
    },
    {
      "address": "AF7CYuqRw61atGBVT9LpxaXuSW9RuGmfnSAEgaHppump",
      "balance": 2143.21592,
      "value": 0.0075007010716513205,
      "price": {
        "usd": 0.0000034997412074334164,
        "quote": 2.7995661589662763e-8
      },
      "marketCap": {
        "usd": 3499.7412074334165,
        "quote": 27.995661589662763
      },
      "liquidity": {
        "usd": 7505.524527654956,
        "quote": 60.039332132
      }
    }
    ],
    "total": 2.598305272023605,
    "totalSol": 0.02085288879816225
    }

---

### GET /wallet/{owner}/page/{page} - Get Wallet Tokens with Pagination

#### `GET /wallet/{owner}/page/{page}`

Retrieves wallet tokens using pagination with a limit of 250 tokens per request.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/page/{page})

---

#### `GET /wallet/{owner}/page/{page}`

Retrieves wallet tokens using pagination with a limit of 250 tokens per request.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/page/{page})

---

### GET /wallet/{owner}/trades - Get Wallet Trades

#### `GET /wallet/{owner}/trades`

Gets the latest trades of a wallet.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/trades)

Query Parameters

  * `cursor` (optional): Cursor for pagination



Response
    
    
    {
      "trades": [
        {
          "tx": "Transaction Signature here",
          "from": {
            "address": "So11111111111111111111111111111111111111112",
            "amount": 0.00009999999747378752,
            "token": {
              "name": "Wrapped SOL",
              "symbol": "SOL",
              "image": "https://image.solanatracker.io/proxy?url=https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
              "decimals": 9
            }
          },
          "to": {
            "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
            "amount": 0.00815899996086955,
            "token": {
              "name": "Raydium",
              "symbol": "RAY",
              "image": "https://image.solanatracker.io/proxy?url=https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
              "decimals": 6
            }
          },
          "price": {
            "usd": 1.7136074522202307,
            "sol": ""
          },
          "volume": {
            "usd": 0.014018403988365319,
            "sol": 0.00009999999747378752
          },
          "wallet": "WALLET_ADDRESS",
          "program": "raydium",
          "time": 1722759119596
        }
      ],
      "nextCursor": 1722759119596,
      "hasNextPage": true
    }

---

#### `GET /wallet/{owner}/trades`

Gets the latest trades of a wallet.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/trades)

Query Parameters

  * `cursor` (optional): Cursor for pagination



Response
    
    
    {
      "trades": [
        {
          "tx": "Transaction Signature here",
          "from": {
            "address": "So11111111111111111111111111111111111111112",
            "amount": 0.00009999999747378752,
            "token": {
              "name": "Wrapped SOL",
              "symbol": "SOL",
              "image": "https://image.solanatracker.io/proxy?url=https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
              "decimals": 9
            }
          },
          "to": {
            "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
            "amount": 0.00815899996086955,
            "token": {
              "name": "Raydium",
              "symbol": "RAY",
              "image": "https://image.solanatracker.io/proxy?url=https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
              "decimals": 6
            }
          },
          "price": {
            "usd": 1.7136074522202307,
            "sol": ""
          },
          "volume": {
            "usd": 0.014018403988365319,
            "sol": 0.00009999999747378752
          },
          "wallet": "WALLET_ADDRESS",
          "program": "raydium",
          "time": 1722759119596
        }
      ],
      "nextCursor": 1722759119596,
      "hasNextPage": true
    }

---

### GET /wallet/{owner}/chart - Get Wallet Portfolio Chart

#### `GET /wallet/{owner}/chart`

Gets wallet portfolio chart data with historical values and PnL information.

**Note:** This only shows data when /wallet/:wallet has been called. Each time that endpoint has been called the total value will be stored.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/chart)

Response
    
    
    {
      "chartData": [
        {
          "date": "2024-12-08",
          "value": 890670.2,
          "timestamp": 1733692405000,
          "pnlPercentage": 0
        },
        {
          "date": "2024-05-14",
          "value": 1450.27,
          "timestamp": 1715668377000,
          "pnlPercentage": -99.84
        },
        {
          "date": "2025-01-22",
          "value": 3938345.2,
          "timestamp": 1737554275000,
          "pnlPercentage": 575.17
        }
      ],
      "pnl": {
        "24h": {
          "value": 105528.2,
          "percentage": 2.8
        },
        "30d": {
          "value": 3346283.26,
          "percentage": 634.99
        }
      }
    }

---

#### `GET /wallet/{owner}/chart`

Gets wallet portfolio chart data with historical values and PnL information.

**Note:** This only shows data when /wallet/:wallet has been called. Each time that endpoint has been called the total value will be stored.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/wallet/{owner}/chart)

Response
    
    
    {
      "chartData": [
        {
          "date": "2024-12-08",
          "value": 890670.2,
          "timestamp": 1733692405000,
          "pnlPercentage": 0
        },
        {
          "date": "2024-05-14",
          "value": 1450.27,
          "timestamp": 1715668377000,
          "pnlPercentage": -99.84
        },
        {
          "date": "2025-01-22",
          "value": 3938345.2,
          "timestamp": 1737554275000,
          "pnlPercentage": 575.17
        }
      ],
      "pnl": {
        "24h": {
          "value": 105528.2,
          "percentage": 2.8
        },
        "30d": {
          "value": 3346283.26,
          "percentage": 634.99
        }
      }
    }

---

### GET /trades/{tokenAddress} - Get Token Trades

#### `GET /trades/{tokenAddress}`

Gets the latest trades for a token across all pools.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress})

Query Parameters for all trade endpoints

  * `cursor` (optional): Cursor for pagination
  * `showMeta` (optional): Set to 'true' to add metadata for from and to tokens
  * `parseJupiter` (optional): Set to 'true' to combine all transfers within a Jupiter swap into a single transaction
  * `hideArb` (optional): Set to 'true' to hide arbitrage or other transactions that don't match token parameters
  * `sortDirection` (optional): Sort direction by descending (DESC) or ascending (ASC) order, default is DESC



Response
    
    
    {
    "trades": [
    {
      "tx": "2FxCUeEDQMtKAZtctMqCkPLM7tHPaGJ4hL7nR6VQnxgLUTaxvRYVjHY6nyWD61NmuN9vLKzHZzWvUK71KBu4xGYb",
      "amount": 164388.579723,
      "priceUsd": 0.0002468380661718994,
      "volume": 40.57735911957043,
      "volumeSol": 0.32487869,
      "type": "sell",
      "wallet": "4fFn7mVd8Bfa5LSmbXjHZnwnPkDQnugSycAbFG3caDVV",
      "time": 1743274860158,
      "program": "jupiter",
      "pools": [
        "3W5ng1TswwN6CYYnpCG5R9EFmbgFoKPSKCt86rKuchqX",
        "1upXtuorkR93tWNNTWPsfPve91Xqt3tUhExhqzdDMaY",
        "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR"
      ]
    },
    {
      "tx": "46CP5Fu8wiLfj8nPu9afN2ByGAAmgiMMq6TQTWqMtWKdCgysYocx97YcU8uaHZL73zrSgYWZKnaGu9rp4QosS1EF",
      "amount": 176227.18061500788,
      "priceUsd": 0.0002488434720999679,
      "volume": 43.85298350262672,
      "volumeSol": 0.3499999999999659,
      "type": "buy",
      "wallet": "7ACsEkYSvVyCE5AuYC6hP1bNs4SpgCDwsfm3UdnyPERk",
      "time": 1743274728903,
      "program": "raydium",
      "pools": [
        "3W5ng1TswwN6CYYnpCG5R9EFmbgFoKPSKCt86rKuchqX"
      ]
    }
    ]
    }

---

#### `GET /trades/{tokenAddress}`

Gets the latest trades for a token across all pools.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress})

Query Parameters for all trade endpoints

  * `cursor` (optional): Cursor for pagination
  * `showMeta` (optional): Set to 'true' to add metadata for from and to tokens
  * `parseJupiter` (optional): Set to 'true' to combine all transfers within a Jupiter swap into a single transaction
  * `hideArb` (optional): Set to 'true' to hide arbitrage or other transactions that don't match token parameters
  * `sortDirection` (optional): Sort direction by descending (DESC) or ascending (ASC) order, default is DESC



Response
    
    
    {
    "trades": [
    {
      "tx": "2FxCUeEDQMtKAZtctMqCkPLM7tHPaGJ4hL7nR6VQnxgLUTaxvRYVjHY6nyWD61NmuN9vLKzHZzWvUK71KBu4xGYb",
      "amount": 164388.579723,
      "priceUsd": 0.0002468380661718994,
      "volume": 40.57735911957043,
      "volumeSol": 0.32487869,
      "type": "sell",
      "wallet": "4fFn7mVd8Bfa5LSmbXjHZnwnPkDQnugSycAbFG3caDVV",
      "time": 1743274860158,
      "program": "jupiter",
      "pools": [
        "3W5ng1TswwN6CYYnpCG5R9EFmbgFoKPSKCt86rKuchqX",
        "1upXtuorkR93tWNNTWPsfPve91Xqt3tUhExhqzdDMaY",
        "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR"
      ]
    },
    {
      "tx": "46CP5Fu8wiLfj8nPu9afN2ByGAAmgiMMq6TQTWqMtWKdCgysYocx97YcU8uaHZL73zrSgYWZKnaGu9rp4QosS1EF",
      "amount": 176227.18061500788,
      "priceUsd": 0.0002488434720999679,
      "volume": 43.85298350262672,
      "volumeSol": 0.3499999999999659,
      "type": "buy",
      "wallet": "7ACsEkYSvVyCE5AuYC6hP1bNs4SpgCDwsfm3UdnyPERk",
      "time": 1743274728903,
      "program": "raydium",
      "pools": [
        "3W5ng1TswwN6CYYnpCG5R9EFmbgFoKPSKCt86rKuchqX"
      ]
    }
    ]
    }

---

### GET /trades/{tokenAddress}/{poolAddress} - Get Pool-Specific Trades

#### `GET /trades/{tokenAddress}/{poolAddress}`

Gets the latest trades for a specific token and pool pair.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress}/{poolAddress})

---

#### `GET /trades/{tokenAddress}/{poolAddress}`

Gets the latest trades for a specific token and pool pair.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress}/{poolAddress})

---

### GET /trades/{tokenAddress}/{poolAddress}/{owner} - Get User-Specific Pool Trades

#### `GET /trades/{tokenAddress}/{poolAddress}/{owner}`

Gets the latest trades for a specific token, pool, and wallet address.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress}/{poolAddress}/{owner})

---

#### `GET /trades/{tokenAddress}/{poolAddress}/{owner}`

Gets the latest trades for a specific token, pool, and wallet address.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress}/{poolAddress}/{owner})

---

### GET /trades/{tokenAddress}/by-wallet/{owner} - Get User-Specific Token Trades

#### `GET /trades/{tokenAddress}/by-wallet/{owner}`

Gets the latest trades for a specific token and wallet address.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress}/by-wallet/{owner})

Query Parameters for all trade endpoints

  * `cursor` (optional): Cursor for pagination
  * `showMeta` (optional): Set to 'true' to add metadata for from and to tokens
  * `parseJupiter` (optional): Set to 'true' to combine all transfers within a Jupiter swap into a single transaction
  * `hideArb` (optional): Set to 'true' to hide arbitrage or other transactions that don't match token parameters



Response for all trade endpoints
    
    
    {
      "trades": [
        {
          "tx": "Transaction Signature",
          "amount": 1000,
          "priceUsd": 0.1,
          "volume": 100,
          "type": "buy",
          "wallet": "WalletAddress",
          "time": 1723726185254,
          "program": "jupiter"
        }
      ],
      "nextCursor": 1723726185254,
      "hasNextPage": true
    }

---

#### `GET /trades/{tokenAddress}/by-wallet/{owner}`

Gets the latest trades for a specific token and wallet address.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/trades/{tokenAddress}/by-wallet/{owner})

Query Parameters for all trade endpoints

  * `cursor` (optional): Cursor for pagination
  * `showMeta` (optional): Set to 'true' to add metadata for from and to tokens
  * `parseJupiter` (optional): Set to 'true' to combine all transfers within a Jupiter swap into a single transaction
  * `hideArb` (optional): Set to 'true' to hide arbitrage or other transactions that don't match token parameters



Response for all trade endpoints
    
    
    {
      "trades": [
        {
          "tx": "Transaction Signature",
          "amount": 1000,
          "priceUsd": 0.1,
          "volume": 100,
          "type": "buy",
          "wallet": "WalletAddress",
          "time": 1723726185254,
          "program": "jupiter"
        }
      ],
      "nextCursor": 1723726185254,
      "hasNextPage": true
    }

---

### GET /chart/{token} - Get OHLCV Data for a token / pool

#### `GET /chart/{token}`

#### `GET /chart/{token}/{pool}`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/chart/{token})

💡 View example using the Datastream for live updates on [Github](%22https://github.com/solanatracker/solana-chart-example%22) or a [preview](%22https://www.solanatracker.io/tokens/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm%22)

Gets OHLCV (Open, High, Low, Close, Volume) data for charts.

Available Intervals

Shorthand| Interval| Shorthand| Interval  
---|---|---|---  
1s| 1 SECOND| 1h| 1 HOUR  
5s| 5 SECOND| 2h| 2 HOUR  
15s| 15 SECOND| 4h| 4 HOUR  
1m| 1 MINUTE| 6h| 6 HOUR  
3m| 3 MINUTE| 8h| 8 HOUR  
5m| 5 MINUTE| 12h| 12 HOUR  
15m| 15 MINUTE| 1d| 1 DAY  
30m| 30 MINUTE| 3d| 3 DAY  
| | 1w| 1 WEEK  
| | 1mn| 1 MONTH  
  
Note: The shorthand "1mn" is used for 1 month to avoid confusion with "1m" (1 minute).

Query Parameters

  * `type` (optional): Time interval (e.g., "1s", "1m", "1h", "1d")
  * `time_from` (optional): Start time (Unix timestamp in seconds)
  * `time_to` (optional): End time (Unix timestamp in seconds)
  * `marketCap` (optional): Return chart for market cap instead of pricing
  * `removeOutliers` (optional): Set to false to disable outlier removal, **true by default**



Response
    
    
    {
      "oclhv": [
        {
          "open": 0.011223689525154462,
          "close": 0.011223689525154462,
          "low": 0.011223689525154462,
          "high": 0.011223689525154462,
          "volume": 683.184501136,
          "time": 1722514489
        },
        {
          "open": 0.011223689525154462,
          "close": 0.011257053686384555,
          "low": 0.011257053686384555,
          "high": 0.011257053686384555,
          "volume": 12788.70421942799,
          "time": 1722514771
        }
      ]
    }

---

#### `GET /chart/{token}`

#### `GET /chart/{token}/{pool}`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/chart/{token})

💡 View example using the Datastream for live updates on [Github](%22https://github.com/solanatracker/solana-chart-example%22) or a [preview](%22https://www.solanatracker.io/tokens/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm%22)

Gets OHLCV (Open, High, Low, Close, Volume) data for charts.

Available Intervals

Shorthand| Interval| Shorthand| Interval  
---|---|---|---  
1s| 1 SECOND| 1h| 1 HOUR  
5s| 5 SECOND| 2h| 2 HOUR  
15s| 15 SECOND| 4h| 4 HOUR  
1m| 1 MINUTE| 6h| 6 HOUR  
3m| 3 MINUTE| 8h| 8 HOUR  
5m| 5 MINUTE| 12h| 12 HOUR  
15m| 15 MINUTE| 1d| 1 DAY  
30m| 30 MINUTE| 3d| 3 DAY  
| | 1w| 1 WEEK  
| | 1mn| 1 MONTH  
  
Note: The shorthand "1mn" is used for 1 month to avoid confusion with "1m" (1 minute).

Query Parameters

  * `type` (optional): Time interval (e.g., "1s", "1m", "1h", "1d")
  * `time_from` (optional): Start time (Unix timestamp in seconds)
  * `time_to` (optional): End time (Unix timestamp in seconds)
  * `marketCap` (optional): Return chart for market cap instead of pricing
  * `removeOutliers` (optional): Set to false to disable outlier removal, **true by default**



Response
    
    
    {
      "oclhv": [
        {
          "open": 0.011223689525154462,
          "close": 0.011223689525154462,
          "low": 0.011223689525154462,
          "high": 0.011223689525154462,
          "volume": 683.184501136,
          "time": 1722514489
        },
        {
          "open": 0.011223689525154462,
          "close": 0.011257053686384555,
          "low": 0.011257053686384555,
          "high": 0.011257053686384555,
          "volume": 12788.70421942799,
          "time": 1722514771
        }
      ]
    }

---

#### `GET /chart/{token}/{pool}`

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/chart/{token})

💡 View example using the Datastream for live updates on [Github](%22https://github.com/solanatracker/solana-chart-example%22) or a [preview](%22https://www.solanatracker.io/tokens/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm%22)

Gets OHLCV (Open, High, Low, Close, Volume) data for charts.

Available Intervals

Shorthand| Interval| Shorthand| Interval  
---|---|---|---  
1s| 1 SECOND| 1h| 1 HOUR  
5s| 5 SECOND| 2h| 2 HOUR  
15s| 15 SECOND| 4h| 4 HOUR  
1m| 1 MINUTE| 6h| 6 HOUR  
3m| 3 MINUTE| 8h| 8 HOUR  
5m| 5 MINUTE| 12h| 12 HOUR  
15m| 15 MINUTE| 1d| 1 DAY  
30m| 30 MINUTE| 3d| 3 DAY  
| | 1w| 1 WEEK  
| | 1mn| 1 MONTH  
  
Note: The shorthand "1mn" is used for 1 month to avoid confusion with "1m" (1 minute).

Query Parameters

  * `type` (optional): Time interval (e.g., "1s", "1m", "1h", "1d")
  * `time_from` (optional): Start time (Unix timestamp in seconds)
  * `time_to` (optional): End time (Unix timestamp in seconds)
  * `marketCap` (optional): Return chart for market cap instead of pricing
  * `removeOutliers` (optional): Set to false to disable outlier removal, **true by default**



Response
    
    
    {
      "oclhv": [
        {
          "open": 0.011223689525154462,
          "close": 0.011223689525154462,
          "low": 0.011223689525154462,
          "high": 0.011223689525154462,
          "volume": 683.184501136,
          "time": 1722514489
        },
        {
          "open": 0.011223689525154462,
          "close": 0.011257053686384555,
          "low": 0.011257053686384555,
          "high": 0.011257053686384555,
          "volume": 12788.70421942799,
          "time": 1722514771
        }
      ]
    }

---

### GET /holders/chart/{token} - Get Holders Chart Data

#### `GET /holders/chart/{token}`

Gets token holder count data over time. Returns up to 1000 of the most recent data points.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/holders/chart/{token})

Query Parameters

  * `type` (optional): Time interval (e.g., "1s", "1m", "1h", "1d"), defaults to "1d"
  * `time_from` (optional): Start time (Unix timestamp in seconds)
  * `time_to` (optional): End time (Unix timestamp in seconds)



Response
    
    
    {
      "holders": [
        {
          "holders": 1235,
          "time": 1722414489
        },
        {
          "holders": 1242,
          "time": 1722514771
        }
      ]
    }

---

#### `GET /holders/chart/{token}`

Gets token holder count data over time. Returns up to 1000 of the most recent data points.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/holders/chart/{token})

Query Parameters

  * `type` (optional): Time interval (e.g., "1s", "1m", "1h", "1d"), defaults to "1d"
  * `time_from` (optional): Start time (Unix timestamp in seconds)
  * `time_to` (optional): End time (Unix timestamp in seconds)



Response
    
    
    {
      "holders": [
        {
          "holders": 1235,
          "time": 1722414489
        },
        {
          "holders": 1242,
          "time": 1722514771
        }
      ]
    }

---

### GET /top-traders/all - Get Top Traders (All Tokens)

#### `GET /top-traders/all`

#### `GET /top-traders/all/{page}`

Gets the most profitable traders across all tokens, with optional pagination.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/top-traders/all)

Gets the most profitable traders across all tokens, with optional pagination.

Query Parameters

  * `expandPnl` (boolean): Include detailed PnL data for each token if true
  * `sortBy` (string): Sort results by metric ("total" or "winPercentage")



Response
    
    
    {
    "wallets":[
      {
         "wallet":"EnQLCLB7NWojruXXNopgH7jhkwoHihTpuzsrtsM2UCSe",
         "summary":{
            "realized":3756474.7271160004,
            "unrealized":15783289.965727912,
            "total":19539764.69284411,
            "totalInvested":8518686.472995985,
            "totalWins":423,
            "totalLosses":848,
            "averageBuyAmount":2681.285469290887,
            "winPercentage":33.05,
            "lossPercentage":66.25,
            "neutralPercentage":0.7
         }
      },
      {
         "wallet":"G1pRtSyKuWSjTqRDcazzKBDzqEF96i1xSURpiXj3yFcc",
         "summary":{
            "realized":5562034.291971359,
            "unrealized":1763696.487146583,
            "total":7325730.779117969,
            "totalInvested":18551286.808092587,
            "totalWins":581,
            "totalLosses":1010,
            "averageBuyAmount":3748.128733793242,
            "winPercentage":36.27,
            "lossPercentage":63.05,
            "neutralPercentage":0.68
         }
      }
    ]
    }

---

#### `GET /top-traders/all`

#### `GET /top-traders/all/{page}`

Gets the most profitable traders across all tokens, with optional pagination.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/top-traders/all)

Gets the most profitable traders across all tokens, with optional pagination.

Query Parameters

  * `expandPnl` (boolean): Include detailed PnL data for each token if true
  * `sortBy` (string): Sort results by metric ("total" or "winPercentage")



Response
    
    
    {
    "wallets":[
      {
         "wallet":"EnQLCLB7NWojruXXNopgH7jhkwoHihTpuzsrtsM2UCSe",
         "summary":{
            "realized":3756474.7271160004,
            "unrealized":15783289.965727912,
            "total":19539764.69284411,
            "totalInvested":8518686.472995985,
            "totalWins":423,
            "totalLosses":848,
            "averageBuyAmount":2681.285469290887,
            "winPercentage":33.05,
            "lossPercentage":66.25,
            "neutralPercentage":0.7
         }
      },
      {
         "wallet":"G1pRtSyKuWSjTqRDcazzKBDzqEF96i1xSURpiXj3yFcc",
         "summary":{
            "realized":5562034.291971359,
            "unrealized":1763696.487146583,
            "total":7325730.779117969,
            "totalInvested":18551286.808092587,
            "totalWins":581,
            "totalLosses":1010,
            "averageBuyAmount":3748.128733793242,
            "winPercentage":36.27,
            "lossPercentage":63.05,
            "neutralPercentage":0.68
         }
      }
    ]
    }

---

#### `GET /top-traders/all/{page}`

Gets the most profitable traders across all tokens, with optional pagination.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/top-traders/all)

Gets the most profitable traders across all tokens, with optional pagination.

Query Parameters

  * `expandPnl` (boolean): Include detailed PnL data for each token if true
  * `sortBy` (string): Sort results by metric ("total" or "winPercentage")



Response
    
    
    {
    "wallets":[
      {
         "wallet":"EnQLCLB7NWojruXXNopgH7jhkwoHihTpuzsrtsM2UCSe",
         "summary":{
            "realized":3756474.7271160004,
            "unrealized":15783289.965727912,
            "total":19539764.69284411,
            "totalInvested":8518686.472995985,
            "totalWins":423,
            "totalLosses":848,
            "averageBuyAmount":2681.285469290887,
            "winPercentage":33.05,
            "lossPercentage":66.25,
            "neutralPercentage":0.7
         }
      },
      {
         "wallet":"G1pRtSyKuWSjTqRDcazzKBDzqEF96i1xSURpiXj3yFcc",
         "summary":{
            "realized":5562034.291971359,
            "unrealized":1763696.487146583,
            "total":7325730.779117969,
            "totalInvested":18551286.808092587,
            "totalWins":581,
            "totalLosses":1010,
            "averageBuyAmount":3748.128733793242,
            "winPercentage":36.27,
            "lossPercentage":63.05,
            "neutralPercentage":0.68
         }
      }
    ]
    }

---

### GET /top-traders/{token} - Get Top Traders for Specific Token

#### `GET /top-traders/{token}`

Gets top 100 traders by PnL for a token.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/top-traders/{token})

Response
    
    
    [
    {
      "wallet": "5cJ59MEVwdGGfPgSQMm2xoiacrh9U3edEWLeQDYRLavu",
      "held": 41549988.501104,
      "sold": 41549988.501104,
      "holding": 0,
      "realized": 663.8706273151051,
      "unrealized": 0,
      "total": 663.8706273151051,
      "total_invested": 345.5038083813247
    },
    {
      "wallet": "4ocG4Vvbv2Dsam2CQaU5etEbvESvX5oZQb5NjTEaJK27",
      "held": 51095238.095238,
      "sold": 51095238.095238,
      "holding": 0,
      "realized": 588.6414311400356,
      "unrealized": 0,
      "total": 588.6414311400356,
      "total_invested": 188.25865967784858
    },
    {
      "wallet": "FJCZZ9fodGG9NSqSbAJadgGVyz4sXDiJX77rYyq7m4ua",
      "held": 23467238.92106,
      "sold": 23467238.92106,
      "holding": 0,
      "realized": 560.522503566342,
      "unrealized": 0,
      "total": 560.522503566342,
      "total_invested": 184.350034205613
    }
    ]

---

#### `GET /top-traders/{token}`

Gets top 100 traders by PnL for a token.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/top-traders/{token})

Response
    
    
    [
    {
      "wallet": "5cJ59MEVwdGGfPgSQMm2xoiacrh9U3edEWLeQDYRLavu",
      "held": 41549988.501104,
      "sold": 41549988.501104,
      "holding": 0,
      "realized": 663.8706273151051,
      "unrealized": 0,
      "total": 663.8706273151051,
      "total_invested": 345.5038083813247
    },
    {
      "wallet": "4ocG4Vvbv2Dsam2CQaU5etEbvESvX5oZQb5NjTEaJK27",
      "held": 51095238.095238,
      "sold": 51095238.095238,
      "holding": 0,
      "realized": 588.6414311400356,
      "unrealized": 0,
      "total": 588.6414311400356,
      "total_invested": 188.25865967784858
    },
    {
      "wallet": "FJCZZ9fodGG9NSqSbAJadgGVyz4sXDiJX77rYyq7m4ua",
      "held": 23467238.92106,
      "sold": 23467238.92106,
      "holding": 0,
      "realized": 560.522503566342,
      "unrealized": 0,
      "total": 560.522503566342,
      "total_invested": 184.350034205613
    }
    ]

---

### GET /stats/{token} - Get Token Stats

#### `GET /stats/{token}`

#### `GET /stats/{token}/{pool}`

Gets detailed stats for a token or token-pool pair over various time intervals.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/stats/{token})

Response
    
    
    {
      "1m": {
        "buyers": 7,
        "sellers": 9,
        "volume": {
          "buys": 642.307406481682,
          "sells": 3071.093119714688,
          "total": 3713.4005261963716
        },
        "transactions": 102,
        "buys": 90,
        "sells": 12,
        "wallets": 14,
        "price": 0.0026899499819631667,
        "priceChangePercentage": 0.017543536395684036
      },
      "5m": {...},
      "15m": {...},
      "24h": {...}
    }

---

#### `GET /stats/{token}`

#### `GET /stats/{token}/{pool}`

Gets detailed stats for a token or token-pool pair over various time intervals.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/stats/{token})

Response
    
    
    {
      "1m": {
        "buyers": 7,
        "sellers": 9,
        "volume": {
          "buys": 642.307406481682,
          "sells": 3071.093119714688,
          "total": 3713.4005261963716
        },
        "transactions": 102,
        "buys": 90,
        "sells": 12,
        "wallets": 14,
        "price": 0.0026899499819631667,
        "priceChangePercentage": 0.017543536395684036
      },
      "5m": {...},
      "15m": {...},
      "24h": {...}
    }

---

#### `GET /stats/{token}/{pool}`

Gets detailed stats for a token or token-pool pair over various time intervals.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/stats/{token})

Response
    
    
    {
      "1m": {
        "buyers": 7,
        "sellers": 9,
        "volume": {
          "buys": 642.307406481682,
          "sells": 3071.093119714688,
          "total": 3713.4005261963716
        },
        "transactions": 102,
        "buys": 90,
        "sells": 12,
        "wallets": 14,
        "price": 0.0026899499819631667,
        "priceChangePercentage": 0.017543536395684036
      },
      "5m": {...},
      "15m": {...},
      "24h": {...}
    }

---

### GET /events/{tokenAddress} - Get Token Events

#### `GET /events/{tokenAddress}`

Gets raw event data for live processing. Returns binary data that needs to be decoded.

**Note:** For non-live statistics, use `/stats/{token}` instead which is more efficient. This endpoint is designed for real-time stats updates

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/events/{tokenAddress})### [Decode example code](https://github.com/solanatracker/data-api-sdk/blob/main/src/event-processor.ts)

Response

Returns binary data (application/octet-stream) that can be decoded into an array of events:
    
    
    [
      {
        "wallet": "8psNvWTrdNTiVRNzAgsou9kETXNJm2SXZyaKuJraVRtf",
        "amount": 5.677347,
        "priceUsd": 10.472407812562192,
        "volume": 59.455493077426524,
        "type": "sell",
        "time": 1749298583015
      },
      {
        "wallet": "7ACsEkYSvVyCE5AuYC6hP1bNs4SpgCDwsfm3UdnyPERk",
        "amount": 2469629.599217,
        "priceUsd": 0.0000098468505465602,
        "volume": 245.0468505465602,
        "type": "buy",
        "time": 1749298314879
      }
    ]

**SDK Usage:** The SDK automatically decodes the binary data. Use the `decodeBinaryEvents` function from the SDK to decode the data manually if needed.

---

#### `GET /events/{tokenAddress}`

Gets raw event data for live processing. Returns binary data that needs to be decoded.

**Note:** For non-live statistics, use `/stats/{token}` instead which is more efficient. This endpoint is designed for real-time stats updates

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/events/{tokenAddress})### [Decode example code](https://github.com/solanatracker/data-api-sdk/blob/main/src/event-processor.ts)

Response

Returns binary data (application/octet-stream) that can be decoded into an array of events:
    
    
    [
      {
        "wallet": "8psNvWTrdNTiVRNzAgsou9kETXNJm2SXZyaKuJraVRtf",
        "amount": 5.677347,
        "priceUsd": 10.472407812562192,
        "volume": 59.455493077426524,
        "type": "sell",
        "time": 1749298583015
      },
      {
        "wallet": "7ACsEkYSvVyCE5AuYC6hP1bNs4SpgCDwsfm3UdnyPERk",
        "amount": 2469629.599217,
        "priceUsd": 0.0000098468505465602,
        "volume": 245.0468505465602,
        "type": "buy",
        "time": 1749298314879
      }
    ]

**SDK Usage:** The SDK automatically decodes the binary data. Use the `decodeBinaryEvents` function from the SDK to decode the data manually if needed.

---

### GET /events/{tokenAddress}/{poolAddress} - Get Pool Events

#### `GET /events/{tokenAddress}/{poolAddress}`

Gets raw event data for a specific token and pool. Returns binary data that needs to be decoded.

**Note:** For non-live statistics, use `/stats/{token}/{pool}` instead which is more efficient.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/events/{tokenAddress}/{poolAddress})### [Decode example code](https://github.com/solanatracker/data-api-sdk/blob/main/src/event-processor.ts)

Response format is the same as `/events/{tokenAddress}`. Code example e

---

#### `GET /events/{tokenAddress}/{poolAddress}`

Gets raw event data for a specific token and pool. Returns binary data that needs to be decoded.

**Note:** For non-live statistics, use `/stats/{token}/{pool}` instead which is more efficient.

### [Test in the Data API Playground ->](https://www.solanatracker.io/account/data-api/playground?endpoint=/events/{tokenAddress}/{poolAddress})### [Decode example code](https://github.com/solanatracker/data-api-sdk/blob/main/src/event-processor.ts)

Response format is the same as `/events/{tokenAddress}`. Code example e

---
*End of file*