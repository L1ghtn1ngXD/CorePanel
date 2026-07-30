const net = require("net");
const {
    WebSocket,
    WebSocketServer
} = require("ws");

function createVncProxy(options = {}) {
    const host = String(
        options.host || "127.0.0.1"
    );

    const port = Math.max(
        1,
        Math.min(
            65535,
            Number(options.port) || 5900
        )
    );

    const webSocketServer =
        new WebSocketServer({
            noServer: true,
            perMessageDeflate: false,
            maxPayload:
                32 * 1024 * 1024
        });

    webSocketServer.on(
        "connection",
        (webSocket) => {
            const vncSocket =
                net.createConnection({
                    host,
                    port
                });

            let closed = false;

            function closeConnection() {
                if (closed) {
                    return;
                }

                closed = true;

                if (!vncSocket.destroyed) {
                    vncSocket.destroy();
                }

                if (
                    webSocket.readyState ===
                    WebSocket.OPEN
                ) {
                    webSocket.close();
                }
            }

            vncSocket.setNoDelay(true);

            vncSocket.on(
                "data",
                (data) => {
                    if (
                        webSocket.readyState ===
                        WebSocket.OPEN
                    ) {
                        webSocket.send(
                            data,
                            {
                                binary: true
                            }
                        );
                    }
                }
            );

            vncSocket.on(
                "error",
                closeConnection
            );

            vncSocket.on(
                "close",
                closeConnection
            );

            webSocket.on(
                "message",
                (data) => {
                    if (!vncSocket.destroyed) {
                        vncSocket.write(
                            Buffer.isBuffer(data)
                                ? data
                                : Buffer.from(data)
                        );
                    }
                }
            );

            webSocket.on(
                "error",
                closeConnection
            );

            webSocket.on(
                "close",
                closeConnection
            );
        }
    );

    function handleUpgrade(
        request,
        socket,
        head
    ) {
        webSocketServer.handleUpgrade(
            request,
            socket,
            head,
            (webSocket) => {
                webSocketServer.emit(
                    "connection",
                    webSocket,
                    request
                );
            }
        );
    }

    function close() {
        for (
            const client of
            webSocketServer.clients
        ) {
            client.close();
        }

        webSocketServer.close();
    }

    return {
        handleUpgrade,
        close
    };
}

module.exports = {
    createVncProxy
};
