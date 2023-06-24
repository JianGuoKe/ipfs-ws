const { WebSocketServer, WebSocket } = require("ws");

const port = process.env.PORT || 80;
const path = "WSPATH" in process.env ? process.env.WSPATH : undefined;
const wss = new WebSocketServer({ port, path });
const channels = new Map();
const clients = new Map();
let timer;

(function clearTimeoutClient() {
  timer = setTimeout(() => {
    const clientIds = [];
    for (const ws of wss.clients) {
      clientIds.push(ws.id);
    }
    for (const clientId of clients.keys()) {
      if (clientIds.includes(clientId)) {
        continue;
      }
      const channel = clients.get(clientId);
      if (!channel) {
        clients.delete(clientId);
      }
      channel.delete(clientId);
      if (channel.size === 0) {
        channels.delete(channelName);
      }
      console.debug("clear!", clientId);
      for (const clientId of channel) {
        const client = getClient(clientId);
        if (client?.readyState !== WebSocket.OPEN) {
          console.warn("client not open", clientId);
          continue;
        }
        client.send(
          JSON.stringify({ command: "exited", clientId, reason: "timeout" })
        );
      }
    }
    if (timer) {
      clearTimeoutClient();
    }
  }, process.env.TIMEOUT || 5 * 60 * 1000);
})();

function getClient(clientId) {
  let client;
  wss.clients.forEach((ws) => {
    if (ws.id === clientId) {
      client = ws;
      return false;
    }
  });
  return client;
}

wss.on("connection", function connection(ws) {
  console.debug("connection...");
  ws.on("message", function message(data) {
    try {
      data = JSON.parse(data.toString());
      console.debug("message...", data, ws.id);
    } catch (err) {
      console.error(err);
    }
    if (data.command === "id") {
      const exists = getClient(data.id);
      if (exists) {
        console.debug("exists!", data.id);
        return ws.send(
          JSON.stringify({ command: "exists", clientId: data.id })
        );
      }
      ws.id = data.id;
    } else if (data.command === "join") {
      if (!data.channel) {
        console.debug("nochannel!");
        return ws.send(JSON.stringify({ command: "nochannel" }));
      }
      if (!ws.id) {
        console.debug("no id!");
        return ws.send(JSON.stringify({ command: "noid" }));
      }
      const joinedChannelName = clients.get(ws.id);
      if (joinedChannelName) {
        const joinedChannel = channels.get(joinedChannelName);
        if (joinedChannelName !== data.channel) {
          if (!joinedChannel) {
            clients.delete(ws.id);
          } else {
            joinedChannel.delete(ws);
          }
        } else {
          if (joinedChannel) {
            console.debug("joined!");
            return ws.send(
              JSON.stringify({ command: "joined", clients: joinedChannel.size })
            );
          }
        }
      }
      let channel = channels.get(data.channel);
      if (!channel) {
        channel = new Set();
        channels.set(data.channel, channel);
      }
      channel.add(ws.id);
      clients.set(ws.id, data.channel);
      for (const clientId of channel) {
        const client = getClient(clientId);
        if (client?.readyState !== WebSocket.OPEN) {
          console.warn("client not open", clientId);
          continue;
        }
        client.send(
          JSON.stringify({ command: "joined", clients: Array.from(channel) })
        );
      }
    } else if (data.command === "exit") {
      if (!ws.id) {
        console.debug("no id!");
        return ws.send(JSON.stringify({ command: "noid" }));
      }
      const channelName = clients.get(ws.id);
      if (!channelName) {
        console.debug("nochannel!");
        return ws.send(JSON.stringify({ command: "nochannel" }));
      }
      const channel = channels.get(channelName);
      channel?.delete(ws.id);
      clients.delete(ws.id);
      if (channel.size === 0) {
        channels.delete(channelName);
      }
      console.debug("exited!", ws.id);
      ws.send(JSON.stringify({ command: "exited", clientId: ws.id }));
      // console.log('existed', channel, ws.id)
      for (const clientId of channel) {        
        const client = getClient(clientId);
        if (client?.readyState !== WebSocket.OPEN) {
          console.warn("client not open", clientId);
          continue;
        }
        client.send(JSON.stringify({ command: "exited", clientId: ws.id }));
      }
    } else if (data.command === "send") {
      if (!ws.id) {
        console.debug("no id!");
        return ws.send(JSON.stringify({ command: "noid" }));
      }
      const channel = channels.get(clients.get(ws.id));
      if (!channel) {
        console.debug("nochannel!");
        return ws.send(JSON.stringify({ command: "nochannel" }));
      }
      for (const clientId of channel) {
        const client = getClient(clientId);
        if (client === ws) {
          continue;
        }
        if (client?.readyState !== WebSocket.OPEN) {
          console.warn("client not open", clientId);
          continue;
        }
        client.send(JSON.stringify({
          command: "sent",
          type: data.type,
          message: data.message,
        }));
      }
    } else {
      console.debug("nocommand!");
      return ws.send(JSON.stringify({ command: "nocommand" }));
    }
  });
  ws.on("close", function message() {
    console.debug("close...", ws.id);
    if (!ws.id) {
      // console.debug("noid!");
      return;
    }
    const channelName = clients.get(ws.id);
    if (!channelName) {
      // console.debug("nochannel!");
      return;
    }
    const channel = channels.get(channelName);
    channel?.delete(ws.id);
    clients.delete(ws.id);
    if (channel.size === 0) {
      channels.delete(channelName);
    }
  });
  ws.on("error", console.error);
});
wss.on("close", function () {
  console.debug("close server...");
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  clients.forEach((channelName, clientId) => {
    channels.get(channelName)?.delete(clientId);
    console.debug("kickout", clientId);
    getClient(clientId)?.send(JSON.stringify({ command: "kickout" }));
  });
  channels.clear();
  clients.clear();
});
console.log("ws litening at " + port, path || "");
module.exports.server = wss;
module.exports.close = function (cb) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  wss.close(cb);
};
module.exports.channels = channels;
module.exports.clients = clients;