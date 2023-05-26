const { WebSocketServer } = require('ws');

const port = process.env.PORT || 80;
const path = 'WSPATH' in process.env ? process.env.WSPATH : undefined;
const wss = new WebSocketServer({ port, path });
const channels = new Map();
const clients = new WeakMap();

wss.on('connection', function connection(ws) {
  console.debug('connection...')
  ws.on('message', function message(data) {
    console.log(data)
    if (data.command === 'join') {
      if (!data.channel) {
        return client.send({ command: 'nochannel' });
      }
      const joinedChannelName = clients.get(ws);
      if (joinedChannelName) {
        const joinedChannel = channels.get(joinedChannelName);
        if (joinedChannelName !== data.channel) {
          if (!joinedChannel) {
            clients.delete(ws);
          } else {
            joinedChannel.delete(ws);
          }
        } else {
          if (joinedChannel) {
            return ws.send({ command: 'joined', clients: joinedChannel.size });
          }
        }
      }
      let channel = channels.get(data.channel);
      if (!channel) {
        channel = new WeakSet();
        channels.set(data.channel, channel);
      }
      channel.add(ws);
      clients.set(ws, data.channel);
      for (const client of channel) {
        if (client.readyState !== WebSocket.OPEN) {
          console.warn('client not open')
          continue;
        }
        return client.send({ command: 'joined', clients: channel.size });
      }
    }
    if (data.command === 'exit') {
      const channelName = clients.get(ws);
      if (!channelName) {
        return client.send({ command: 'nochannel' });
      }
      const channel = channels.get(channelName);
      channel?.delete(ws);
      clients.delete(ws);
      if (channel.size === 0) {
        channels.delete(channelName);
      }
      return client.send({ command: 'exited' });
    }
    if (data.command === 'send') {
      const channel = channels.get(clients.get(ws));
      if (!channel) {
        return client.send({ command: 'nochannel' });
      }
      for (const client of channel) {
        if (client === ws) {
          continue;
        }
        if (client.readyState !== WebSocket.OPEN) {
          console.warn('client not open')
          continue;
        }
        client.send({ command: 'sent', type: data.type, message: data.message });
      }
    }
  });
  ws.on('close', function message() {
    console.debug('close...')
    const channelName = clients.get(ws);
    if (!channelName) {
      return;
    }
    const channel = channels.get(channelName);
    channel?.delete(ws);
    clients.delete(ws);
    if (channel.size === 0) {
      channels.delete(channelName);
    }
  });
});
wss.on('close', function () {
  console.debug('close server...')
  clients.forEach((channelName, client) => {
    channels.get(channelName)?.delete(client);
    client.send({ command: 'kickout' });
  });
  channels.clear();
  clients.clear();
})
console.log('ws litening at ' + port, path || '')