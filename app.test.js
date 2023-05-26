const WebSocket = require('ws');
const chai = require('chai');

describe('ws send message', function () {
  before(function () {
    process.env.PORT = 8811
    require('./app')
  })

  it('join and send message', function (cb) {
    const ws = new WebSocket('ws://localhost:8811');

    ws.on('open', function open() {
      ws.send(JSON.stringify({ command: 'join' }));
    });

    ws.on('message', function message(data) {
      console.log(data)
      if (data.command === 'joined') {
        cb();
      }
    });
  })

})