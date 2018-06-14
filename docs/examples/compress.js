/* eslint no-console: 0 */

const http = require('http');
const rayo = require('../../packages/rayo');
const compress = require('../../packages/plugins/compress');
const { createReadStream } = require('fs');
const { PassThrough } = require('stream');

const payload = [
  {
    _id: '5b1786f4c6a03f53953fbfd6',
    index: 0,
    guid: 'a042b38e-4d91-47c3-ad41-c4a5172fa15f',
    isActive: false,
    balance: '$3,431.78',
    picture: 'http://placehold.it/32x32',
    age: 24,
    eyeColor: 'blue',
    name: 'Saundra Fry',
    gender: 'female',
    company: 'KRAGGLE',
    email: 'saundrafry@kraggle.com',
    phone: '+1 (902) 413-2434',
    address: '497 Kansas Place, Crumpler, Guam, 4584',
    about: `Exercitation ullamco labore incididunt dolor.
      Id ex sit amet est laboris sunt anim incididunt in fugiat nulla.
      Eiusmod anim nulla dolore eu culpa culpa Lorem amet quis dolor eu.
      Ad excepteur adipisicing aliquip aliqua in ut duis dolore
      consectetur esse est. Nostrud magna officia magna duis non enim
      cillum officia do irure deserunt esse velit.\r\n`,
    registered: '2017-04-02T09:54:18 -10:00',
    latitude: 19.169584,
    longitude: -87.239525,
    tags: ['consequat', 'minim', 'non', 'proident', 'id', 'id', 'velit'],
    friends: [
      {
        id: 0,
        name: 'Austin Pennington'
      },
      {
        id: 1,
        name: 'Marietta Velazquez'
      },
      {
        id: 2,
        name: 'Hunt Acosta'
      }
    ],
    greeting: 'Hello, Saundra Fry! You have 7 unread messages.',
    favoriteFruit: 'banana'
  },
  {
    _id: '5b1786f4ee371baf4aea7bce',
    index: 1,
    guid: 'f031d6c5-aeb6-4820-8b8c-3687718f5aba',
    isActive: false,
    balance: '$3,506.41',
    picture: 'http://placehold.it/32x32',
    age: 26,
    eyeColor: 'blue',
    name: 'Aurelia Serrano',
    gender: 'female',
    company: 'TELPOD',
    email: 'aureliaserrano@telpod.com',
    phone: '+1 (840) 551-2767',
    address: '749 Livonia Avenue, Walland, Hawaii, 4581',
    about: `Magna dolor eu do voluptate adipisicing. Veniam elit consectetur
      officia dolor amet non ipsum nisi anim duis nisi enim. Nostrud non
      nulla aliqua ad exercitation qui exercitation sunt irure aliqua pariatur
      nulla ea. Et ad sunt consectetur sit minim reprehenderit consectetur
      laborum ullamco ut nulla. Enim elit duis cupidatat sint laboris commodo
      dolor ut. Labore est consequat culpa magna nostrud eiusmod qui magna
      aute officia quis amet sunt. Et consequat amet amet laborum tempor
      sint esse nostrud voluptate duis.\r\n`,
    registered: '2016-05-01T07:20:37 -10:00',
    latitude: -9.32134,
    longitude: 34.516307,
    tags: ['nulla', 'duis', 'enim', 'deserunt', 'incididunt', 'aute', 'exercitation'],
    friends: [
      {
        id: 0,
        name: 'Cunningham Gutierrez'
      },
      {
        id: 1,
        name: 'Letitia Santos'
      },
      {
        id: 2,
        name: 'Rena Boyd'
      }
    ],
    greeting: 'Hello, Aurelia Serrano! You have 3 unread messages.',
    favoriteFruit: 'apple'
  },
  {
    _id: '5b1786f4dd990ca77d0999d3',
    index: 2,
    guid: '647a0558-95ad-4b0b-8a73-629bec2f870c',
    isActive: false,
    balance: '$1,410.17',
    picture: 'http://placehold.it/32x32',
    age: 25,
    eyeColor: 'green',
    name: 'Clarke Ray',
    gender: 'male',
    company: 'GAPTEC',
    email: 'clarkeray@gaptec.com',
    phone: '+1 (874) 528-2771',
    address: '828 Miller Place, Longoria, Missouri, 7306',
    about: `Laboris sit cillum eu dolore laboris nisi. Ullamco voluptate
      reprehenderit eu ea anim. Cillum velit in ea velit anim velit cupidatat
      irure culpa. Exercitation consequat consectetur voluptate reprehenderit
      anim.\r\n`,
    registered: '2015-11-28T03:41:34 -11:00',
    latitude: 59.097331,
    longitude: 58.29156,
    tags: [
      'laborum',
      'adipisicing',
      'excepteur',
      'duis',
      'voluptate',
      'enim',
      'cupidatat'
    ],
    friends: [
      {
        id: 0,
        name: 'Palmer Newman'
      },
      {
        id: 1,
        name: 'Hooper Frye'
      },
      {
        id: 2,
        name: 'Ernestine Potter'
      }
    ],
    greeting: 'Hello, Clarke Ray! You have 7 unread messages.',
    favoriteFruit: 'strawberry'
  },
  {
    _id: '5b1786f402d1f465c1dd1228',
    index: 3,
    guid: 'bc259cf4-ec5c-4136-95d8-a6743810318b',
    isActive: true,
    balance: '$1,140.80',
    picture: 'http://placehold.it/32x32',
    age: 25,
    eyeColor: 'brown',
    name: 'Kent Moreno',
    gender: 'male',
    company: 'BRISTO',
    email: 'kentmoreno@bristo.com',
    phone: '+1 (859) 516-2339',
    address: '665 Brown Street, Martinsville, Palau, 4672',
    about: `Sunt id dolor ad deserunt pariatur ullamco non culpa reprehenderit
      cillum. Lorem consectetur nisi pariatur ut Lorem quis. Consectetur
      consequat eu ut velit. Culpa nostrud occaecat Lorem incididunt ipsum
      laborum aliquip amet velit dolor voluptate deserunt voluptate. Anim
      aliqua fugiat voluptate dolore dolor voluptate occaecat. Aute irure
      laborum dolore cupidatat dolore reprehenderit reprehenderit.\r\n`,
    registered: '2014-07-17T09:23:14 -10:00',
    latitude: 8.702061,
    longitude: -117.135672,
    tags: ['amet', 'sint', 'deserunt', 'ex', 'ullamco', 'duis', 'Lorem'],
    friends: [
      {
        id: 0,
        name: 'Sanford Steele'
      },
      {
        id: 1,
        name: 'Leigh Norman'
      },
      {
        id: 2,
        name: 'Silva Malone'
      }
    ],
    greeting: 'Hello, Kent Moreno! You have 8 unread messages.',
    favoriteFruit: 'banana'
  },
  {
    _id: '5b1786f43b4a15b7eb22931d',
    index: 4,
    guid: '94ed861e-75a0-4568-b78f-cf440c47f1a4',
    isActive: true,
    balance: '$2,699.02',
    picture: 'http://placehold.it/32x32',
    age: 25,
    eyeColor: 'blue',
    name: 'Murphy Boyer',
    gender: 'male',
    company: 'UPDAT',
    email: 'murphyboyer@updat.com',
    phone: '+1 (835) 467-3289',
    address: '516 Seaview Court, Ribera, Federated States Of Micronesia, 8991',
    about: `Quis velit proident laboris pariatur eiusmod sint consequat id
      commodo veniam ad elit. Ut non eu do exercitation aliquip incididunt
      labore. Adipisicing veniam qui ad esse tempor enim culpa ullamco Lorem
      dolor ipsum. Et consequat magna eiusmod ipsum veniam cupidatat culpa
      cupidatat. Sit esse cupidatat eu aliquip.\r\n`,
    registered: '2016-11-30T09:17:35 -11:00',
    latitude: 72.16688,
    longitude: -93.820987,
    tags: ['voluptate', 'culpa', 'velit', 'in', 'quis', 'proident', 'incididunt'],
    friends: [
      {
        id: 0,
        name: 'Coleman Pope'
      },
      {
        id: 1,
        name: 'Lottie Vance'
      },
      {
        id: 2,
        name: 'Mayra Woodard'
      }
    ],
    greeting: 'Hello, Murphy Boyer! You have 7 unread messages.',
    favoriteFruit: 'strawberry'
  },
  {
    _id: '5b1786f4d5dafd7544b457b4',
    index: 5,
    guid: 'b905397f-d03c-48d0-b688-06a738e2dd10',
    isActive: true,
    balance: '$2,429.20',
    picture: 'http://placehold.it/32x32',
    age: 26,
    eyeColor: 'brown',
    name: 'Avila Howell',
    gender: 'male',
    company: 'CENTREXIN',
    email: 'avilahowell@centrexin.com',
    phone: '+1 (808) 460-3217',
    address: '470 Gunnison Court, Riviera, Maryland, 2811',
    about: `Sit culpa reprehenderit duis voluptate dolore in aute.
      Ea nostrud sit consectetur nostrud. Cupidatat ea do deserunt incididunt.
      Sint dolore occaecat consequat irure ullamco reprehenderit anim aute
      reprehenderit. Officia reprehenderit in esse do proident culpa. Excepteur
      dolor mollit veniam veniam nulla nostrud minim sunt. Excepteur ut anim
      id velit minim nisi excepteur incididunt.\r\n`,
    registered: '2014-06-15T11:24:11 -10:00',
    latitude: 84.488849,
    longitude: -80.90535,
    tags: ['adipisicing', 'velit', 'ut', 'minim', 'id', 'eiusmod', 'ipsum'],
    friends: [
      {
        id: 0,
        name: 'Cora Burke'
      },
      {
        id: 1,
        name: 'Barker Irwin'
      },
      {
        id: 2,
        name: 'Sharlene Green'
      }
    ],
    greeting: 'Hello, Avila Howell! You have 6 unread messages.',
    favoriteFruit: 'banana'
  },
  {
    _id: '5b1786f474faf9add68219e7',
    index: 6,
    guid: 'b83534ac-5e7a-4e70-bc7e-fdadeeaee165',
    isActive: true,
    balance: '$2,924.97',
    picture: 'http://placehold.it/32x32',
    age: 24,
    eyeColor: 'blue',
    name: 'Colon Huber',
    gender: 'male',
    company: 'ZOLARITY',
    email: 'colonhuber@zolarity.com',
    phone: '+1 (807) 509-3644',
    address: '445 Cypress Avenue, Ernstville, New Mexico, 877',
    about: `Ex dolore in excepteur consectetur mollit aute do et veniam
      incididunt exercitation nostrud. Reprehenderit minim officia deserunt
      est tempor magna cupidatat laborum eiusmod pariatur ut. Nulla officia
      dolor ea mollit. Ex eiusmod deserunt cillum do cupidatat aute commodo
      voluptate magna occaecat aliqua non qui. Consequat cillum deserunt
      laboris labore ullamco non duis quis voluptate voluptate ut. Incididunt
      aliqua ipsum consectetur sint minim in adipisicing ex sint velit.\r\n`,
    registered: '2018-02-22T10:04:43 -11:00',
    latitude: 20.760658,
    longitude: 127.043786,
    tags: ['adipisicing', 'excepteur', 'mollit', 'nostrud', 'elit', 'mollit', 'et'],
    friends: [
      {
        id: 0,
        name: 'Fanny Dunlap'
      },
      {
        id: 1,
        name: 'Cook Schultz'
      },
      {
        id: 2,
        name: 'Noel Underwood'
      }
    ],
    greeting: 'Hello, Colon Huber! You have 6 unread messages.',
    favoriteFruit: 'apple'
  }
];

const ray = rayo({ port: 5050 });

/**
 * No compression on this endpoint.
 */
ray.bridge('/').get((req, res) => res.send(payload));

/**
 * Compression on this endpoint, piped to the response.
 * Note that the header needs to be set so `compress` can figure out whether
 * the response can be compressed or not.
 */
ray
  .bridge('/pipe')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    createReadStream('/Users/Stefan/Downloads/Menu.json').pipe(res);
  });

ray
  .bridge('/pipe-sm')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const bufferStream = new PassThrough();
    bufferStream.pipe(res);
    bufferStream.end(Buffer.from(JSON.stringify(payload)));
  });

/**
 * Compression on this endpoint, sent (`res.send()`) to the response.
 * The header is guessed by `res.send()`.
 */
ray
  .bridge('/send')
  .through(compress())
  .get((req, res) => res.send(payload));

/**
 * Compression on this endpoint, "ended" with the response.
 * Note that the header needs to be set so `compress` can figure out whether
 * the response can be compressed or not.
 */
ray
  .bridge('/end')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  });

/**
 * Compression on this endpoint.
 * "written" to -and "ended" with the response.
 */
ray
  .bridge('/write-compress')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.write('Hello!');
    res.end('I am compressed!');
  });

/**
 * No compression (since there's no header) on this endpoint.
 * written to the response and "ended".
 */
ray
  .bridge('/write')
  .through(compress())
  .get((req, res) => {
    res.write('Hello, I have not Content-Type.');
    res.end();
  });

/**
 * No compression (since there's no header) on this endpoint.
 * "ended" with the response.
 */
ray
  .bridge('/end-plain')
  .through(compress())
  .get((req, res) => {
    res.end('Hello, I have not Content-Type.');
  });

/**
 * No compression (images are not "compressible") on this endpoint.
 * piped with the response.
 */
ray.bridge('/img').get((req, res) => {
  const image = http.request(
    {
      host: 'img-aws.ehowcdn.com',
      path: '/600x600p/photos.demandstudios.com/getty/article/165/76/87490163.jpg'
    },
    (response) => {
      res.setHeader('Content-Type', response.headers['content-type']);
      response.pipe(res);
    }
  );

  image.end();
});

ray.start((address) => {
  console.log(`Up on port ${address.port}`);
});
