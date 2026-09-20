/* Synced from https://github.com/ephinea4haven/ephinea4haven.github.io/blob/master/assets/js/mag-evolution.js
 * Canonical generator: scripts/build_mag_data.py in the source repository.
 * Regenerate here: npm run sync:data
 * Do not edit by hand. */
window.MAG_EVOLUTION = {
  "meta": {
    "idGroups": {
      "A": [
        "Viridia",
        "Skyly",
        "Purplenum",
        "Redria",
        "Yellowboze"
      ],
      "B": [
        "Greenill",
        "Bluefull",
        "Pinkal",
        "Oran",
        "Whitill"
      ],
      "1": [
        "Viridia",
        "Bluefull",
        "Redria",
        "Whitill"
      ],
      "2": [
        "Greenill",
        "Purplenum",
        "Oran"
      ],
      "3": [
        "Skyly",
        "Pinkal",
        "Yellowboze"
      ]
    },
    "idColors": {
      "Viridia": "#2e9e5b",
      "Greenill": "#7ed957",
      "Skyly": "#5bc8f5",
      "Bluefull": "#2f6fe0",
      "Purplenum": "#9b59d0",
      "Pinkal": "#f27fb8",
      "Redria": "#e04a4a",
      "Oran": "#f0902a",
      "Yellowboze": "#e8d44d",
      "Whitill": "#e8ecf2"
    },
    "pbNames": {
      "Golla": "角鹿",
      "Pilla": "神像",
      "Estlla": "海豚",
      "Farlla": "海蛇",
      "Leilla": "女神",
      "Mylla & Youlla": "双子"
    },
    "effects": {
      "Invincibility": "无敌",
      "Resta": "圣泉术",
      "S&D": "强攻·强体"
    },
    "events": [
      "100PB",
      "10%HP",
      "BOSS"
    ],
    "colors": [
      {
        "name": "Red",
        "hex": "#FF3319",
        "exclusive": false
      },
      {
        "name": "Blue",
        "hex": "#3333FF",
        "exclusive": false
      },
      {
        "name": "Yellow",
        "hex": "#FFE619",
        "exclusive": false
      },
      {
        "name": "Green",
        "hex": "#19FF19",
        "exclusive": false
      },
      {
        "name": "Purple",
        "hex": "#CC19FF",
        "exclusive": false
      },
      {
        "name": "Black",
        "hex": "#191933",
        "exclusive": false
      },
      {
        "name": "White",
        "hex": "#E6FFFF",
        "exclusive": false
      },
      {
        "name": "Cyan",
        "hex": "#19E6FF",
        "exclusive": false
      },
      {
        "name": "Brown",
        "hex": "#804C33",
        "exclusive": false
      },
      {
        "name": "Orange",
        "hex": "#FF6600",
        "exclusive": false
      },
      {
        "name": "Slate Blue",
        "hex": "#808BF9",
        "exclusive": false
      },
      {
        "name": "Olive",
        "hex": "#808000",
        "exclusive": false
      },
      {
        "name": "Turquoise",
        "hex": "#00F0B6",
        "exclusive": false
      },
      {
        "name": "Fuchsia",
        "hex": "#CC1964",
        "exclusive": false
      },
      {
        "name": "Gray",
        "hex": "#7F7F7F",
        "exclusive": false
      },
      {
        "name": "Cream",
        "hex": "#FEFED5",
        "exclusive": false
      },
      {
        "name": "Pink",
        "hex": "#FE7FC8",
        "exclusive": false
      },
      {
        "name": "Dark Green",
        "hex": "#007F52",
        "exclusive": false
      },
      {
        "name": "Chartreuse",
        "hex": "#7FFF00",
        "exclusive": true
      },
      {
        "name": "Azure",
        "hex": "#007FFF",
        "exclusive": true
      },
      {
        "name": "Royal Purple",
        "hex": "#660066",
        "exclusive": true
      },
      {
        "name": "Ruby",
        "hex": "#F90505",
        "exclusive": true
      },
      {
        "name": "Sapphire",
        "hex": "#0A0AF2",
        "exclusive": true
      },
      {
        "name": "Emerald",
        "hex": "#007F00",
        "exclusive": true
      },
      {
        "name": "Gold",
        "hex": "#9F7E3A",
        "exclusive": true
      },
      {
        "name": "Silver",
        "hex": "#8D9BA6",
        "exclusive": true
      },
      {
        "name": "Bronze",
        "hex": "#A0654E",
        "exclusive": true
      },
      {
        "name": "Plum",
        "hex": "#7F337F",
        "exclusive": true
      },
      {
        "name": "Violet",
        "hex": "#2B0757",
        "exclusive": true
      },
      {
        "name": "Goldenrod",
        "hex": "#F2A400",
        "exclusive": true
      }
    ]
  },
  "classes": {
    "HU": {
      "label": "战士",
      "en": "Hunters",
      "tieBreak": "POW",
      "stage1": {
        "name": "Varuna",
        "zh": "伐楼那",
        "cond": [
          "HU 职业"
        ],
        "pb": "Farlla",
        "triggers": {
          "100PB": {
            "effect": "Invincibility",
            "rate": "40%"
          },
          "BOSS": {
            "effect": "S&D",
            "rate": "40%"
          }
        }
      },
      "stage2": [
        {
          "name": "Rudra",
          "zh": "楼陀罗",
          "cond": [
            "POW 最大"
          ],
          "pb": "Golla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "50–85%"
            },
            "10%HP": {
              "effect": "Resta",
              "rate": "0–35%"
            },
            "BOSS": {
              "effect": "S&D",
              "rate": "50%"
            }
          },
          "from": "Varuna"
        },
        {
          "name": "Marutah",
          "zh": "摩娄陀",
          "cond": [
            "DEX 最大"
          ],
          "pb": "Pilla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "40–75%"
            },
            "10%HP": {
              "effect": "S&D",
              "rate": "0–35%"
            }
          },
          "from": "Varuna"
        },
        {
          "name": "Vayu",
          "zh": "伐由",
          "cond": [
            "MIND 最大"
          ],
          "pb": "Mylla & Youlla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "45–80%"
            },
            "10%HP": {
              "effect": "Resta",
              "rate": "0–35%"
            },
            "BOSS": {
              "effect": "Resta",
              "rate": "45%"
            }
          },
          "from": "Varuna"
        }
      ],
      "stage3": {
        "special": null,
        "A": [
          {
            "name": "Varaha",
            "zh": "筏罗诃",
            "cond": [
              "POW ≥ DEX ≥ MIND",
              "DEX = MIND > POW"
            ],
            "pb": "Golla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              0,
              2
            ]
          },
          {
            "name": "Bhirava",
            "zh": "拜拉瓦",
            "cond": [
              "POW ≥ MIND > DEX"
            ],
            "pb": "Pilla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              2,
              1
            ]
          },
          {
            "name": "Ila",
            "zh": "伊罗",
            "cond": [
              "DEX > POW > MIND"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "10%HP": {
                "effect": "Resta",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              3,
              1
            ]
          },
          {
            "name": "Nandin",
            "zh": "南迪",
            "cond": [
              "DEX > MIND ≥ POW"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "25–60%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            },
            "span": [
              4,
              1
            ]
          },
          {
            "name": "Kabanda",
            "zh": "迦槃陀",
            "cond": [
              "MIND > POW ≥ DEX"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "S&D",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              5,
              1
            ]
          },
          {
            "name": "Ushasu",
            "zh": "乌莎斯",
            "cond": [
              "MIND > DEX > POW"
            ],
            "pb": "Golla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "35–70%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "35%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "35–70%"
              }
            },
            "span": [
              6,
              1
            ]
          }
        ],
        "B": [
          {
            "name": "Kama",
            "zh": "迦摩",
            "cond": [
              "POW ≥ DEX ≥ MIND",
              "DEX = MIND > POW"
            ],
            "pb": "Pilla",
            "triggers": {
              "10%HP": {
                "effect": "S&D",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              0,
              2
            ]
          },
          {
            "name": "Apsaras",
            "zh": "阿普萨拉斯",
            "cond": [
              "POW ≥ MIND > DEX"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "25–60%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            },
            "span": [
              2,
              1
            ]
          },
          {
            "name": "Garuda",
            "zh": "迦楼罗",
            "cond": [
              "DEX > POW > MIND"
            ],
            "pb": "Pilla",
            "triggers": {
              "100PB": {
                "effect": "Resta",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "Resta",
                "rate": "30%"
              }
            },
            "span": [
              3,
              1
            ]
          },
          {
            "name": "Yaksa",
            "zh": "夜叉",
            "cond": [
              "DEX > MIND ≥ POW"
            ],
            "pb": "Golla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "35–70%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "35%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "35–70%"
              }
            },
            "span": [
              4,
              1
            ]
          },
          {
            "name": "Bana",
            "zh": "巴纳",
            "cond": [
              "MIND > POW ≥ DEX"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "20%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            },
            "span": [
              5,
              1
            ]
          },
          {
            "name": "Soma",
            "zh": "苏摩",
            "cond": [
              "MIND > DEX > POW"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "25–60%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            },
            "span": [
              6,
              1
            ]
          }
        ],
        "rules": [
          "POW ≥ DEX ≥ MIND",
          "DEX = MIND > POW",
          "POW ≥ MIND > DEX",
          "DEX > POW > MIND",
          "DEX > MIND ≥ POW",
          "MIND > POW ≥ DEX",
          "MIND > DEX > POW"
        ]
      },
      "stage4": [
        {
          "formula": "DEF + DEX = POW + MIND",
          "group": "1",
          "male": {
            "name": "Deva",
            "zh": "提婆",
            "cond": [
              "男性 HU"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Savitri",
            "zh": "萨维特里",
            "cond": [
              "女性 HU"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          }
        },
        {
          "formula": "DEF + MIND = POW + DEX",
          "group": "2",
          "male": {
            "name": "Rati",
            "zh": "拉蒂",
            "cond": [
              "男性 HU"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Savitri",
            "zh": "萨维特里",
            "cond": [
              "女性 HU"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          }
        },
        {
          "formula": "DEF + POW = DEX + MIND",
          "group": "3",
          "male": {
            "name": "Rati",
            "zh": "拉蒂",
            "cond": [
              "男性 HU"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Savitri",
            "zh": "萨维特里",
            "cond": [
              "女性 HU"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          }
        }
      ]
    },
    "RA": {
      "label": "枪手",
      "en": "Rangers",
      "tieBreak": "DEX",
      "stage1": {
        "name": "Kalki",
        "zh": "迦尔吉",
        "cond": [
          "RA 职业"
        ],
        "pb": "Estlla",
        "triggers": {
          "100PB": {
            "effect": "Invincibility",
            "rate": "40%"
          },
          "BOSS": {
            "effect": "S&D",
            "rate": "40%"
          }
        }
      },
      "stage2": [
        {
          "name": "Surya",
          "zh": "苏利耶",
          "cond": [
            "POW 最大"
          ],
          "pb": "Golla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "50–85%"
            },
            "10%HP": {
              "effect": "Resta",
              "rate": "0–35%"
            },
            "BOSS": {
              "effect": "S&D",
              "rate": "50%"
            }
          },
          "from": "Kalki"
        },
        {
          "name": "Mitra",
          "zh": "密多罗",
          "cond": [
            "DEX 最大"
          ],
          "pb": "Pilla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "40–75%"
            },
            "10%HP": {
              "effect": "S&D",
              "rate": "0–35%"
            }
          },
          "from": "Kalki"
        },
        {
          "name": "Tapas",
          "zh": "塔帕斯",
          "cond": [
            "MIND 最大"
          ],
          "pb": "Mylla & Youlla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "45–80%"
            },
            "10%HP": {
              "effect": "Resta",
              "rate": "0–35%"
            },
            "BOSS": {
              "effect": "Resta",
              "rate": "45%"
            }
          },
          "from": "Kalki"
        }
      ],
      "stage3": {
        "special": null,
        "A": [
          {
            "name": "Kama",
            "zh": "迦摩",
            "cond": [
              "POW > DEX ≥ MIND",
              "DEX ≥ MIND ≥ POW",
              "POW = MIND > DEX"
            ],
            "pb": "Pilla",
            "triggers": {
              "10%HP": {
                "effect": "S&D",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              0,
              3
            ]
          },
          {
            "name": "Bhirava",
            "zh": "拜拉瓦",
            "cond": [
              "POW > MIND > DEX",
              "DEX ≥ POW > MIND"
            ],
            "pb": "Pilla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              3,
              2
            ]
          },
          {
            "name": "Varaha",
            "zh": "筏罗诃",
            "cond": [
              "MIND > POW ≥ DEX"
            ],
            "pb": "Golla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              5,
              1
            ]
          },
          {
            "name": "Apsaras",
            "zh": "阿普萨拉斯",
            "cond": [
              "MIND > DEX > POW"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "25–60%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            },
            "span": [
              6,
              1
            ]
          }
        ],
        "B": [
          {
            "name": "Madhu",
            "zh": "摩图",
            "cond": [
              "POW > DEX ≥ MIND"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "20%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "20–55%"
              }
            },
            "span": [
              0,
              1
            ]
          },
          {
            "name": "Kaitabha",
            "zh": "凯塔巴",
            "cond": [
              "POW > MIND > DEX",
              "DEX ≥ POW > MIND"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              3,
              2
            ]
          },
          {
            "name": "Varaha",
            "zh": "筏罗诃",
            "cond": [
              "DEX ≥ MIND ≥ POW",
              "POW = MIND > DEX"
            ],
            "pb": "Golla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              1,
              2
            ]
          },
          {
            "name": "Kabanda",
            "zh": "迦槃陀",
            "cond": [
              "MIND > POW ≥ DEX"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "S&D",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              5,
              1
            ]
          },
          {
            "name": "Durga",
            "zh": "杜尔迦",
            "cond": [
              "MIND > DEX > POW"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "25–60%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            },
            "span": [
              6,
              1
            ]
          }
        ],
        "rules": [
          "POW > DEX ≥ MIND",
          "DEX ≥ MIND ≥ POW",
          "POW = MIND > DEX",
          "POW > MIND > DEX",
          "DEX ≥ POW > MIND",
          "MIND > POW ≥ DEX",
          "MIND > DEX > POW"
        ]
      },
      "stage4": [
        {
          "formula": "DEF + DEX = POW + MIND",
          "group": "1",
          "male": {
            "name": "Pushan",
            "zh": "普善",
            "cond": [
              "男性 RA"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Rukmin",
            "zh": "鲁克敏",
            "cond": [
              "女性 RA"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          }
        },
        {
          "formula": "DEF + MIND = POW + DEX",
          "group": "2",
          "male": {
            "name": "Pushan",
            "zh": "普善",
            "cond": [
              "男性 RA"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Rukmin",
            "zh": "鲁克敏",
            "cond": [
              "女性 RA"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          }
        },
        {
          "formula": "DEF + POW = DEX + MIND",
          "group": "3",
          "male": {
            "name": "Pushan",
            "zh": "普善",
            "cond": [
              "男性 RA"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Diwari",
            "zh": "迪瓦里",
            "cond": [
              "女性 RA"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "50–85%"
              }
            }
          }
        }
      ]
    },
    "FO": {
      "label": "法师",
      "en": "Forces",
      "tieBreak": "MIND",
      "stage1": {
        "name": "Vritra",
        "zh": "弗栗多",
        "cond": [
          "FO 职业"
        ],
        "pb": "Leilla",
        "triggers": {
          "100PB": {
            "effect": "Invincibility",
            "rate": "40%"
          },
          "BOSS": {
            "effect": "Resta",
            "rate": "40%"
          }
        }
      },
      "stage2": [
        {
          "name": "Sumba",
          "zh": "修姆巴",
          "cond": [
            "POW 最大"
          ],
          "pb": "Golla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "50–85%"
            },
            "10%HP": {
              "effect": "Resta",
              "rate": "0–35%"
            },
            "BOSS": {
              "effect": "S&D",
              "rate": "50%"
            }
          },
          "from": "Vritra"
        },
        {
          "name": "Ashvinau",
          "zh": "阿什维瑙",
          "cond": [
            "DEX 最大"
          ],
          "pb": "Pilla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "40–75%"
            },
            "10%HP": {
              "effect": "S&D",
              "rate": "0–35%"
            }
          },
          "from": "Vritra"
        },
        {
          "name": "Namuci",
          "zh": "那姆奇",
          "cond": [
            "MIND 最大"
          ],
          "pb": "Mylla & Youlla",
          "triggers": {
            "100PB": {
              "effect": "Invincibility",
              "rate": "45–80%"
            },
            "10%HP": {
              "effect": "Resta",
              "rate": "0–35%"
            },
            "BOSS": {
              "effect": "Resta",
              "rate": "45%"
            }
          },
          "from": "Vritra"
        }
      ],
      "stage3": {
        "special": [
          {
            "name": "Andhaka",
            "zh": "安陀迦",
            "cond": [
              "POW > Others"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            }
          },
          {
            "name": "Bana",
            "zh": "巴纳",
            "cond": [
              "DEX ≥ POW",
              "MIND ≥ POW"
            ],
            "pb": "Estlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "20%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            }
          }
        ],
        "A": [
          {
            "name": "Naraka",
            "zh": "那罗迦",
            "cond": [
              "POW > DEX ≥ MIND"
            ],
            "pb": "Golla",
            "triggers": {
              "100PB": {
                "effect": "Resta",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "Resta",
                "rate": "30%"
              }
            },
            "span": [
              0,
              1
            ]
          },
          {
            "name": "Ravana",
            "zh": "罗波那",
            "cond": [
              "POW > MIND > DEX"
            ],
            "pb": "Farlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "S&D",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              1,
              1
            ]
          },
          {
            "name": "Ribhava",
            "zh": "里巴瓦",
            "cond": [
              "DEX > POW > MIND"
            ],
            "pb": "Farlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "25–60%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            },
            "span": [
              2,
              1
            ]
          },
          {
            "name": "Sita",
            "zh": "悉多",
            "cond": [
              "DEX > MIND ≥ POW"
            ],
            "pb": "Pilla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              3,
              1
            ]
          },
          {
            "name": "Naga",
            "zh": "那伽",
            "cond": [
              "MIND ≥ POW ≥ DEX",
              "POW = DEX > MIND"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "10%HP": {
                "effect": "S&D",
                "rate": "20%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "20–55%"
              }
            },
            "span": [
              4,
              2
            ]
          },
          {
            "name": "Kabanda",
            "zh": "迦槃陀",
            "cond": [
              "MIND ≥ DEX > POW"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "S&D",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              6,
              1
            ]
          }
        ],
        "B": [
          {
            "name": "Marica",
            "zh": "摩利遮",
            "cond": [
              "POW > DEX ≥ MIND"
            ],
            "pb": "Pilla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              0,
              1
            ]
          },
          {
            "name": "Naga",
            "zh": "那伽",
            "cond": [
              "POW > MIND > DEX"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "10%HP": {
                "effect": "S&D",
                "rate": "20%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "20–55%"
              }
            },
            "span": [
              1,
              1
            ]
          },
          {
            "name": "Garuda",
            "zh": "迦楼罗",
            "cond": [
              "DEX > POW > MIND"
            ],
            "pb": "Pilla",
            "triggers": {
              "100PB": {
                "effect": "Resta",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "Resta",
                "rate": "30%"
              }
            },
            "span": [
              2,
              1
            ]
          },
          {
            "name": "Bhirava",
            "zh": "拜拉瓦",
            "cond": [
              "DEX > MIND ≥ POW"
            ],
            "pb": "Pilla",
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "30–65%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "30%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "30–65%"
              }
            },
            "span": [
              3,
              1
            ]
          },
          {
            "name": "Kumara",
            "zh": "鸠摩罗",
            "cond": [
              "MIND ≥ POW ≥ DEX",
              "POW = DEX > MIND"
            ],
            "pb": "Golla",
            "triggers": {
              "100PB": {
                "effect": "Resta",
                "rate": "35–70%"
              },
              "10%HP": {
                "effect": "Resta",
                "rate": "35%"
              },
              "BOSS": {
                "effect": "Resta",
                "rate": "35%"
              }
            },
            "span": [
              4,
              2
            ]
          },
          {
            "name": "Ila",
            "zh": "伊罗",
            "cond": [
              "MIND ≥ DEX > POW"
            ],
            "pb": "Mylla & Youlla",
            "triggers": {
              "10%HP": {
                "effect": "Resta",
                "rate": "25%"
              },
              "BOSS": {
                "effect": "S&D",
                "rate": "25–60%"
              }
            },
            "span": [
              6,
              1
            ]
          }
        ],
        "rules": [
          "POW > DEX ≥ MIND",
          "POW > MIND > DEX",
          "DEX > POW > MIND",
          "DEX > MIND ≥ POW",
          "MIND ≥ POW ≥ DEX",
          "POW = DEX > MIND",
          "MIND ≥ DEX > POW"
        ]
      },
      "stage4": [
        {
          "formula": "DEF + DEX = POW + MIND",
          "group": "1",
          "male": {
            "name": "Nidra",
            "zh": "尼德拉",
            "cond": [
              "男性 FO"
            ],
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Sato",
            "zh": "萨托",
            "cond": [
              "女性 FO"
            ],
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "0–35%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "50%"
              }
            }
          }
        },
        {
          "formula": "DEF + MIND = POW + DEX",
          "group": "2",
          "male": {
            "name": "Nidra",
            "zh": "尼德拉",
            "cond": [
              "男性 FO"
            ],
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Bhima",
            "zh": "比玛",
            "cond": [
              "女性 FO"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            }
          }
        },
        {
          "formula": "DEF + POW = DEX + MIND",
          "group": "3",
          "male": {
            "name": "Nidra",
            "zh": "尼德拉",
            "cond": [
              "男性 FO"
            ],
            "triggers": {
              "100PB": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "50–85%"
              }
            }
          },
          "female": {
            "name": "Bhima",
            "zh": "比玛",
            "cond": [
              "女性 FO"
            ],
            "triggers": {
              "100PB": {
                "effect": "S&D",
                "rate": "50–85%"
              },
              "10%HP": {
                "effect": "Invincibility",
                "rate": "50%"
              },
              "BOSS": {
                "effect": "Invincibility",
                "rate": "0–35%"
              }
            }
          }
        }
      ]
    }
  }
};
