export const mockTimeEqElements = [
    {
        "id": 0,
        "finalPoints": [
            {
                "x": 0.2,
                "y": 0
            },
            {
                "x": 0.2,
                "y": 5.2
            },
            {
                "x": 0,
                "y": 5.2
            },
            {
                "x": 0,
                "y": 5.8
            },
            {
                "x": 9.7,
                "y": 5.8
            },
            {
                "x": 9.7,
                "y": 5.6
            },
            {
                "x": 10,
                "y": 5.6
            },
            {
                "x": 10,
                "y": 2.4
            },
            {
                "x": 10.4,
                "y": 2.4
            },
            {
                "x": 10.4,
                "y": 0.1
            },
            {
                "x": 7.3,
                "y": 0.1
            },
            {
                "x": 7.3,
                "y": 0
            },
            {
                "x": 0.2,
                "y": 0
            }
        ],
        "comments": "obstruction"
    },
    {
        "id": 1,
        "finalPoints": [
            {
                "x": 10,
                "y": 5.5
            },
            {
                "x": 10,
                "y": 4.2
            }
        ],
        "comments": "opening"
    },
    {
        "id": 2,
        "finalPoints": [
            {
                "x": 10.4,
                "y": 2.4
            },
            {
                "x": 10.4,
                "y": 0.1
            }
        ],
        "comments": "opening"
    }
]

export const mockRadiationElements = [
        {
            "id": 5,
            "finalPoints": [
                {
                    "x": 4.1,
                    "y": 1.8
                },
                {
                    "x": 3,
                    "y": 1.8
                }
            ],
            "comments": "door"
        },
    {
        "id": 0,
        "finalPoints": [
            {
                "x": 4,
                "y": 1.4
            },
            {
                "x": 6.2,
                "y": 1.4
            }
        ],
        "comments": "obstruction"
    },
    {
        "id": 1,
        "finalPoints": [
            {
                "x": 3.3,
                "y": 4.8
            },
            {
                "x": 4.1,
                "y": 4.8
            },
            {
                "x": 4.1,
                "y": 3.3
            },
            {
                "x": 3.2,
                "y": 3.3
            },
            {
                "x": 3.2,
                "y": 4.8
            }
        ],
        "comments": "obstruction"
    },
    {
        "id": 2,
        "finalPoints": [
            {
                "x": 5.5,
                "y": 2.9
            }
        ],
        "comments": "fire"
    },
    {
        "id": 3,
        "finalPoints": [
            {
                "x": 0,
                "y": 6.1
            },
            {
                "x": 0.1,
                "y": 2.5
            },
            {
                "x": 3.5,
                "y": 2
            },
            {
                "x": 3.6,
                "y": 0
            }
        ],
        "comments": "escapeRoute"
    }
]

export const testElements = [
    {
      "type": "polyline",
      "points": [
          {
              "x": 234.58699702156903,
              "y": 1418.6927915113936
          },
          {
              "x": 497.1010174980868,
              "y": 1418.6927915113936
          },
          {
              "x": 497.1010174980868,
              "y": 1329.3263164555578
          },
          {
              "x": 234.58699702156903,
              "y": 1329.3263164555578
          },
          {
              "x": 234.58699702156903,
              "y": 1418.6927915113936
          }
      ],
      
      "comments": "obstruction",
      "id": 0
  },
  {
    "type": "rect",
    "points": [
        {
            "x": 184.3183548026614,
            "y": 1156.178771034876
        },
        {
            "x": 441.24697058818936,
            "y": 1301.399293000609
        }
    ],
    "comments": "mesh",
    "id": 1
  },
  {
    "type": "polyline",
    "points": [
        {
            "x": 201.0745688756306,
            "y": 932.7625833952864
        },
        {
            "x": 385.392923678292,
            "y": 932.7625833952864
        },
        {
            "x": 385.392923678292,
            "y": 1061.2268912880504
        },
        {
            "x": 201.0745688756306,
            "y": 1061.2268912880504
        },
        {
            "x": 201.0745688756306,
            "y": 932.7625833952864
        }
    ],
    "comments": "stairObstruction",
    "id": 2
  }
  ]

export const stair_els = [{"type":"polyline","points":[{"x":608.1668951990071,"y":917.2903999410438},{"x":665.2875428143834,"y":917.2903999410438},{"x":665.2875428143834,"y":897.130171370911},{"x":694.2222290039062,"y":897.3333740234375},{"x":695.5278856695827,"y":1098.7324570722392},{"x":608.1668951990071,"y":1098.7324570722392},{"x":608.1668951990071,"y":917.2903999410438}],"comments":"stairObstruction","id":0},{"type":"rect","points":[{"x":608.1668951990071,"y":917.2903999410438},{"x":693.3333129882812,"y":970.2222595214844}],"comments":"landing","id":1},{"type":"rect","points":[{"x":608.1668951990071,"y":1051.6919237419293},{"x":695.5278856695827,"y":1098.7324570722392}],"comments":"stairMesh","id":2},{"type":"polyline","points":[{"x":608.1668951990071,"y":917.2903999410438},{"x":608.1668951990071,"y":971.051009461398},{"x":574.5665142487857,"y":971.051009461398},{"x":574.5665142487857,"y":1112.1726094523278},{"x":668.6475809094055,"y":1112.1726094523278},{"x":668.6475809094055,"y":1165.933218972682},{"x":433.4449142578559,"y":1165.933218972682},{"x":433.4449142578559,"y":1108.8125713573056},{"x":507.3657523483429,"y":1108.8125713573056},{"x":507.3657523483429,"y":883.6900189908224},{"x":433.4449142578559,"y":883.6900189908224},{"x":433.4449142578559,"y":836.6494856605125},{"x":668.6475809094055,"y":836.6494856605125},{"x":668.6475809094055,"y":883.6900189908224},{"x":574.5665142487857,"y":883.6900189908224},{"x":574.5665142487857,"y":920.6504380360659},{"x":608.1668951990071,"y":920.6504380360659},{"x":608.1668951990071,"y":971.051009461398}],"comments":"obstruction","id":3},{"type":"rect","points":[{"x":608.1668951990071,"y":887.0500570858445},{"x":695.5278856695827,"y":1102.0924951672614}],"comments":"stairMesh","id":4},{"type":"rect","points":[{"x":433.4449142578559,"y":836.6494856605125},{"x":668.6475809094055,"y":887.0500570858445}],"comments":"mesh","id":5},{"type":"rect","points":[{"x":507.3657523483429,"y":883.6900189908224},{"x":608.1668951990071,"y":1112.1726094523278}],"comments":"mesh","id":6},{"type":"rect","points":[{"x":433.4449142578559,"y":1108.8125713573056},{"x":668.6475809094055,"y":1165.933218972682}],"comments":"mesh","id":7},                {
                    "type": "rect",
                    "points": [
                        {
                            "x": 608.888916015625,
                            "y": 1052
                        },
                        {
                            "x": 691.9756980703875,
                            "y": 1099.020226347086
                        }
                    ],
                    "comments": "landing",
                    "id": 8
                }]
{/*
{"elementList":[{"type":"polyline","points":[{"x":608.1668951990071,"y":917.2903999410438},{"x":665.2875428143834,"y":917.2903999410438},{"x":665.2875428143834,"y":897.130171370911},{"x":694.2222290039062,"y":897.3333740234375},{"x":695.5278856695827,"y":1098.7324570722392},{"x":608.1668951990071,"y":1098.7324570722392},{"x":608.1668951990071,"y":917.2903999410438}],"comments":"stairObstruction","id":0},{"type":"rect","points":[{"x":608.1668951990071,"y":917.2903999410438},{"x":693.3333129882812,"y":970.2222595214844}],"comments":"landing","id":1},{"type":"rect","points":[{"x":608.1668951990071,"y":1051.6919237419293},{"x":695.5278856695827,"y":1098.7324570722392}],"comments":"stairMesh","id":2},{"type":"polyline","points":[{"x":608.1668951990071,"y":917.2903999410438},{"x":608.1668951990071,"y":971.051009461398},{"x":574.5665142487857,"y":971.051009461398},{"x":574.5665142487857,"y":1112.1726094523278},{"x":668.6475809094055,"y":1112.1726094523278},{"x":668.6475809094055,"y":1165.933218972682},{"x":433.4449142578559,"y":1165.933218972682},{"x":433.4449142578559,"y":1108.8125713573056},{"x":507.3657523483429,"y":1108.8125713573056},{"x":507.3657523483429,"y":883.6900189908224},{"x":433.4449142578559,"y":883.6900189908224},{"x":433.4449142578559,"y":836.6494856605125},{"x":668.6475809094055,"y":836.6494856605125},{"x":668.6475809094055,"y":883.6900189908224},{"x":574.5665142487857,"y":883.6900189908224},{"x":574.5665142487857,"y":920.6504380360659},{"x":608.1668951990071,"y":920.6504380360659},{"x":608.1668951990071,"y":971.051009461398}],"comments":"obstruction","id":3},{"type":"rect","points":[{"x":608.1668951990071,"y":887.0500570858445},{"x":695.5278856695827,"y":1102.0924951672614}],"comments":"stairMesh","id":4},{"type":"rect","points":[{"x":433.4449142578559,"y":836.6494856605125},{"x":668.6475809094055,"y":887.0500570858445}],"comments":"mesh","id":5},{"type":"rect","points":[{"x":507.3657523483429,"y":883.6900189908224},{"x":608.1668951990071,"y":1112.1726094523278}],"comments":"mesh","id":6},{"type":"rect","points":[{"x":433.4449142578559,"y":1108.8125713573056},{"x":668.6475809094055,"y":1165.933218972682}],"comments":"mesh","id":7}],"z":0,"wall_height":3,"wall_thickness":0.2,"stair_height":20,"px_per_m":33.6,"fire_floor":0,"total_floors":8,"stair_enclosure_roof_z":25}

*/}


export const mockRadAPIParams =  [
    [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        10.35
    ],
    [
        0,
        1.2,
        2.4,
        3.5999999999999996,
        5.120459156782531,
        6.3204591567825315,
        7.520459156782532,
        9.352439756686653,
        10.552439756686653,
        11.752439756686652,
        12.967707134626034,
        13.798241890504794
    ],
    [
        6.363175307973213,
        5.175998158550895,
        3.9964876922923867,
        2.8342319615668,
        2.3338112370936126,
        2.577102339521506,
        3.2735665636045987,
        4.1480441286038765,
        5.104823209281279,
        6.147533643924898,
        6.0038604284247725,
        6.003332407921453
    ],
    [
        0.31180611318206564,
        0.47124220132480643,
        0.7904518908522363,
        1.5716709278996468,
        2.3179333771197017,
        1.9009429005330298,
        0,
        0,
        0,
        0,
        0,
        0
    ],
    [
        0.0026533065097377223,
        0.0045955302020744765,
        0.009143136621402696,
        0.022807717489928544,
        0.03823887730483287,
        0.02937309677957744,
        0,
        0,
        0,
        0,
        0,
        0
    ],
    [
        0.0026533065097377223,
        0.007248836711812199,
        0.016391973333214897,
        0.03919969082314344,
        0.07743856812797631,
        0.10681166490755375,
        0.10681166490755375,
        0.10681166490755375,
        0.10681166490755375,
        0.10681166490755375,
        0.10681166490755375,
        0.10681166490755375
    ]
]

