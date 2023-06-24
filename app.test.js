const WebSocket = require("ws");
const { expect } = require("chai");

before(function () {
  process.env.PORT = 8811;
  require("./app");
});

after(function (cb) {
  Array.from(require("./app").server.clients).forEach((socket, i) => {
    console.log(i, socket.id, socket.readyState);
    socket.close();
  });
  require("./app").close(cb);
});

describe("ws send message", function () {
  it("join no channel", function (cb) {
    const ws = new WebSocket("ws://localhost:8811");

    ws.on("open", function open() {
      ws.send(JSON.stringify({ command: "join" }));
    });

    ws.on("message", function message(data) {
      console.log(data.toString());
      const json = JSON.parse(data.toString());
      expect(json.command).eql("nochannel");
      ws.close();
      cb();
    });
  });

  it("join no id", function (cb) {
    const ws = new WebSocket("ws://localhost:8811");

    ws.on("open", function open() {
      ws.send(JSON.stringify({ command: "join", channel: "1112233" }));
    });

    ws.on("message", function message(data) {
      console.log(data.toString());
      const json = JSON.parse(data.toString());
      expect(json.command).eql("noid");
      ws.close();
      cb();
    });
  });

  it("join and send message", function (cb) {
    const ws = new WebSocket("ws://localhost:8811");
    const ws2 = new WebSocket("ws://localhost:8811");
    const other = new WebSocket("ws://localhost:8811");

    ws.on("open", function open() {
      ws.send(JSON.stringify({ command: "id", id: "client-001" }));
      ws.send(JSON.stringify({ command: "join", channel: "1112233" }));
    });
    ws2.on("open", function open() {
      ws2.send(JSON.stringify({ command: "id", id: "client-002" }));
      setTimeout(() => {
        ws2.send(JSON.stringify({ command: "join", channel: "1112233" }));
      }, 0);
    });
    other.on("open", function open() {
      other.send(JSON.stringify({ command: "id", id: "client-other" }));
      other.send(JSON.stringify({ command: "join", channel: "other" }));
    });

    let wsJoinedMsgCount = 0;
    ws.on("message", function message(data) {
      const json = JSON.parse(data.toString());
      wsJoinedMsgCount++;
      if (wsJoinedMsgCount <= 2) {
        expect(json.command).eql("joined");

        console.log("client-001", json, wsJoinedMsgCount);
        expect(json.clients.length).eql(wsJoinedMsgCount);
      } else if (wsJoinedMsgCount === 3) {
        console.log("client-001", json, wsJoinedMsgCount);
        expect(json.command).eql("exited");
        expect(json.clientId).eql("client-002");
        ws.send(
          JSON.stringify({
            command: "send",
            type: "sync",
            message: { a: 1, b: ["ok"] },
          })
        );

        ws.send(
          JSON.stringify({
            command: "exit",
          })
        );

        ws.send(
          JSON.stringify({
            command: "send",
            type: "sync",
            message: "error",
          })
        );

        ws.close();
      } else if (wsJoinedMsgCount === 4) {
        console.log("client-001", json, wsJoinedMsgCount);
        expect(json.command).eql("exited");
        expect(json.clientId).eql("client-001");
      } else if (wsJoinedMsgCount === 5) {
        expect(json.command).eql("nochannel");

        expect(Array.from(require("./app").clients.keys())).eql([]);
        expect(Array.from(require("./app").channels.keys())).eql([]);
        cb();
      } else {
        expect.fail(json.command);
      }
    });

    let msgCount = 0;
    ws2.on("message", function message(data) {
      const json = JSON.parse(data.toString());
      msgCount++;
      console.log("client-002", json, msgCount);
      if (msgCount === 1) {
        expect(json.command).eql("joined");
        expect(json.clients).eql(["client-001", "client-002"]);

        ws.send(
          JSON.stringify({
            command: "send",
            type: "sync",
            message: { a: 1, b: ["ok"] },
          })
        );
      }
      if (msgCount === 2) {
        expect(json.command).eql("sent");
        expect(json.type).eql("sync");
        expect(json.message).eql({ a: 1, b: ["ok"] });

        expect(Array.from(require("./app").clients.keys()).sort()).eql([
          "client-001",
          "client-other",
          "client-002",
        ].sort());
        expect(Array.from(require("./app").channels.keys()).sort()).eql([
          "1112233",
          "other",
        ].sort());

        ws2.send(
          JSON.stringify({
            command: "exit",
          })
        );

        other.close();
        ws2.close();
      }

      if (msgCount === 3) {
        expect(json.command).eql("exited");
      }

      expect(msgCount).not.greaterThan(3);
    });

    other.on("message", function message(data) {
      const json = JSON.parse(data.toString());
      expect(json.command).eql("joined");
    });
  });
});
