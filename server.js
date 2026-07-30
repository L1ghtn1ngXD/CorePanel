const path = require("path");
const crypto = require("crypto");
const http = require("http");

const express = require("express");
const session = require("express-session");
const { Server } = require("socket.io");

const platform = require("./system/platform");
const authRouter = require("./routes/auth");

const qemuModule =
    process.platform === "linux"
        ? (
            platform.qemu ||
            require("./system/linux/qemu")
        )
        : null;


const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT) || 3000;

const SESSION_SECRET =
    process.env.COREPANEL_SESSION_SECRET ||
    crypto.randomBytes(48).toString("hex");

app.disable("x-powered-by");

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

const sessionMiddleware = session({
    name: "corepanel.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
});

app.use(sessionMiddleware);
app.use("/api/auth", authRouter);

function requireAuthentication(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    next();
}

function requirePageAuthentication(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    next();
}

function getProcessModule(res) {
    if (!platform.processes) {
        res.status(501).json({
            success: false,
            message: "Process management is not supported."
        });

        return null;
    }

    return platform.processes;
}

function getQemuModule(res) {
    if (!qemuModule) {
        res.status(501).json({
            success: false,
            message:
                "QEMU management is only supported on Linux."
        });

        return null;
    }

    return qemuModule;
}

function getProcessErrorMessage(error, fallbackMessage) {
    const stderr = String(error?.stderr || "").trim();
    const stdout = String(error?.stdout || "").trim();
    const message = String(error?.message || "").trim();

    return stderr || stdout || message || fallbackMessage;
}

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

app.get(
    "/panel",
    requirePageAuthentication,
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "views",
                "panel.html"
            )
        );
    }
);

app.get(
    "/api/platform",
    requireAuthentication,
    (req, res) => {
        res.json({
            platform: platform.name
        });
    }
);

app.get(
    "/api/system/info",
    requireAuthentication,
    async (req, res) => {
        if (!platform.systemInfo?.getSystemInfo) {
            return res.status(501).json({
                success: false,
                message: "System information is not supported."
            });
        }

        try {
            const information =
                await platform.systemInfo.getSystemInfo();

            res.json(information);
        } catch (error) {
            console.error(
                "System information error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to read system information."
            });
        }
    }
);

app.get(
    "/api/processes",
    requireAuthentication,
    async (req, res) => {
        const processModule = getProcessModule(res);

        if (!processModule) {
            return;
        }

        try {
            const processes =
                await processModule.getProcesses();

            res.json({
                success: true,
                processes,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(
                "Process list error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to read the process list."
            });
        }
    }
);

app.post(
    "/api/processes/icon",
    requireAuthentication,
    async (req, res) => {
        const processModule = getProcessModule(res);

        if (!processModule) {
            return;
        }

        const executablePath =
            String(req.body.path || "").trim();

        if (!executablePath || executablePath.length > 4096) {
            return res.status(400).json({
                success: false,
                message: "Invalid executable path."
            });
        }

        try {
            const icon =
                await processModule.ensureIcon(
                    executablePath
                );

            res.json({
                success: true,
                icon
            });
        } catch (error) {
            console.error(
                "Process icon error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to extract the process icon."
            });
        }
    }
);

app.get(
    "/api/processes/icon/:fileName",
    requireAuthentication,
    (req, res) => {
        const processModule = getProcessModule(res);

        if (!processModule) {
            return;
        }

        const iconPath =
            processModule.getIconPath(
                String(req.params.fileName || "")
            );

        if (!iconPath) {
            return res.status(404).end();
        }

        res.sendFile(iconPath);
    }
);

app.post(
    "/api/processes/:pid/end",
    requireAuthentication,
    async (req, res) => {
        const processModule = getProcessModule(res);

        if (!processModule) {
            return;
        }

        try {
            await processModule.endProcess(
                req.params.pid
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "End process error:",
                error
            );

            res.status(500).json({
                success: false,
                message: getProcessErrorMessage(
                    error,
                    "Failed to end the process."
                )
            });
        }
    }
);

app.post(
    "/api/processes/:pid/suspend",
    requireAuthentication,
    async (req, res) => {
        const processModule = getProcessModule(res);

        if (!processModule) {
            return;
        }

        try {
            await processModule.suspendProcess(
                req.params.pid
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Suspend process error:",
                error
            );

            res.status(500).json({
                success: false,
                message: getProcessErrorMessage(
                    error,
                    "Failed to suspend the process."
                )
            });
        }
    }
);

app.post(
    "/api/processes/:pid/resume",
    requireAuthentication,
    async (req, res) => {
        const processModule = getProcessModule(res);

        if (!processModule) {
            return;
        }

        try {
            await processModule.resumeProcess(
                req.params.pid
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Resume process error:",
                error
            );

            res.status(500).json({
                success: false,
                message: getProcessErrorMessage(
                    error,
                    "Failed to resume the process."
                )
            });
        }
    }
);


app.get(
    "/api/qemu/status",
    requireAuthentication,
    async (req, res) => {
        const module =
            getQemuModule(res);

        if (!module) {
            return;
        }

        try {
            const status =
                await module
                    .getSupportStatus();

            res.json({
                success: true,
                ...status
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message:
                    getProcessErrorMessage(
                        error,
                        "Failed to read QEMU status."
                    )
            });
        }
    }
);

app.get(
    "/api/qemu/machines",
    requireAuthentication,
    async (req, res) => {
        const module =
            getQemuModule(res);

        if (!module) {
            return;
        }

        try {
            const machines =
                await module
                    .getVirtualMachines();

            res.json({
                success: true,
                machines,
                timestamp:
                    Date.now()
            });
        } catch (error) {
            console.error(
                "QEMU machine list error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    getProcessErrorMessage(
                        error,
                        "Failed to read virtual machines."
                    )
            });
        }
    }
);

app.post(
    "/api/qemu/machines/:name/:action",
    requireAuthentication,
    async (req, res) => {
        const module =
            getQemuModule(res);

        if (!module) {
            return;
        }

        const action =
            String(
                req.params.action ||
                ""
            ).trim();

        const allowedActions =
            new Set([
                "start",
                "shutdown",
                "destroy",
                "reboot",
                "reset",
                "suspend",
                "resume"
            ]);

        if (
            !allowedActions.has(
                action
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Unsupported virtual machine action."
            });
        }

        try {
            await module.runDomainAction(
                req.params.name,
                action
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "QEMU action error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    getProcessErrorMessage(
                        error,
                        "The virtual machine action failed."
                    )
            });
        }
    }
);

app.post(
    "/api/qemu/machines/:name/autostart",
    requireAuthentication,
    async (req, res) => {
        const module =
            getQemuModule(res);

        if (!module) {
            return;
        }

        try {
            await module.setAutostart(
                req.params.name,
                Boolean(
                    req.body.enabled
                )
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "QEMU autostart error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    getProcessErrorMessage(
                        error,
                        "Failed to change virtual machine autostart."
                    )
            });
        }
    }
);

app.get(
    "/api/services",
    requireAuthentication,
    async (req, res) => {
        if (!platform.services) {
            return res.status(501).json({
                success: false,
                message: "Services are not supported."
            });
        }

        try {
            const services =
                await platform.services.getServices();

            res.json({
                success: true,
                services,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(
                "Service list error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Failed to read services."
            });
        }
    }
);

app.post(
    "/api/services/:name/start",
    requireAuthentication,
    async (req, res) => {
        if (!platform.services) {
            return res.status(501).json({
                success: false,
                message: "Services are not supported."
            });
        }

        try {
            await platform.services.startService(
                req.params.name
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Start service error:",
                error
            );

            res.status(500).json({
                success: false,
                message: getProcessErrorMessage(
                    error,
                    "Failed to start the service."
                )
            });
        }
    }
);

app.post(
    "/api/services/:name/stop",
    requireAuthentication,
    async (req, res) => {
        if (!platform.services) {
            return res.status(501).json({
                success: false,
                message: "Services are not supported."
            });
        }

        try {
            await platform.services.stopService(
                req.params.name
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Stop service error:",
                error
            );

            res.status(500).json({
                success: false,
                message: getProcessErrorMessage(
                    error,
                    "Failed to stop the service."
                )
            });
        }
    }
);

app.post(
    "/api/services/:name/restart",
    requireAuthentication,
    async (req, res) => {
        if (!platform.services) {
            return res.status(501).json({
                success: false,
                message: "Services are not supported."
            });
        }

        try {
            await platform.services.restartService(
                req.params.name
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Restart service error:",
                error
            );

            res.status(500).json({
                success: false,
                message: getProcessErrorMessage(
                    error,
                    "Failed to restart the service."
                )
            });
        }
    }
);

app.post(
    "/api/services/:name/startup",
    requireAuthentication,
    async (req, res) => {
        if (!platform.services) {
            return res.status(501).json({
                success: false,
                message: "Services are not supported."
            });
        }

        try {
            await platform.services.setStartType(
                req.params.name,
                req.body.startType
            );

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Change service startup type error:",
                error
            );

            res.status(500).json({
                success: false,
                message: getProcessErrorMessage(
                    error,
                    "Failed to change the startup type."
                )
            });
        }
    }
);

app.use(
    "/vendor/xterm",
    express.static(
        path.join(
            __dirname,
            "node_modules",
            "@xterm",
            "xterm"
        )
    )
);

app.use(
    "/vendor/xterm-addon-fit",
    express.static(
        path.join(
            __dirname,
            "node_modules",
            "@xterm",
            "addon-fit"
        )
    )
);

app.use(
    express.static(
        path.join(__dirname, "public"),
        {
            index: false
        }
    )
);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Resource not found."
    });
});

io.engine.use(sessionMiddleware);

io.use((socket, next) => {
    if (!socket.request.session?.userId) {
        return next(
            new Error("Authentication required.")
        );
    }

    next();
});

io.on("connection", (socket) => {
    const terminals = new Map();

    function closeTerminal(terminalId) {
        const terminal = terminals.get(terminalId);

        if (!terminal) {
            return;
        }

        terminals.delete(terminalId);

        try {
            terminal.kill();
        } catch {
        }
    }

    socket.on("terminal:create", (request = {}) => {
        if (!platform.console?.createTerminal) {
            socket.emit("terminal:error", {
                terminalId: request.terminalId,
                message: "Terminal is not supported."
            });

            return;
        }

        if (terminals.size >= 8) {
            socket.emit("terminal:error", {
                terminalId: request.terminalId,
                message: "Terminal limit reached."
            });

            return;
        }

        const terminalId = String(
            request.terminalId || ""
        );

        if (
            !/^[a-zA-Z0-9_-]{1,64}$/.test(terminalId) ||
            terminals.has(terminalId)
        ) {
            socket.emit("terminal:error", {
                terminalId,
                message: "Invalid terminal identifier."
            });

            return;
        }

        try {
            const terminal =
                platform.console.createTerminal({
                    columns: request.columns,
                    rows: request.rows
                });

            terminals.set(terminalId, terminal);

            terminal.onData((data) => {
                socket.emit("terminal:data", {
                    terminalId,
                    data
                });
            });

            terminal.onExit((event) => {
                terminals.delete(terminalId);

                socket.emit("terminal:exit", {
                    terminalId,
                    exitCode: event.exitCode,
                    signal: event.signal
                });
            });

            socket.emit("terminal:created", {
                terminalId,
                processId: terminal.pid
            });
        } catch (error) {
            console.error(
                "Terminal creation error:",
                error
            );

            socket.emit("terminal:error", {
                terminalId,
                message: "Failed to create terminal."
            });
        }
    });

    socket.on("terminal:input", (request = {}) => {
        const terminalId = String(
            request.terminalId || ""
        );

        const terminal = terminals.get(terminalId);

        if (!terminal) {
            return;
        }

        const data = String(request.data || "");

        if (data.length > 8192) {
            return;
        }

        terminal.write(data);
    });

    socket.on("terminal:resize", (request = {}) => {
        const terminalId = String(
            request.terminalId || ""
        );

        const terminal = terminals.get(terminalId);

        if (!terminal) {
            return;
        }

        const columns = Math.max(
            20,
            Math.min(
                400,
                Number(request.columns) || 100
            )
        );

        const rows = Math.max(
            5,
            Math.min(
                200,
                Number(request.rows) || 30
            )
        );

        try {
            terminal.resize(columns, rows);
        } catch {
        }
    });

    socket.on("terminal:close", (request = {}) => {
        closeTerminal(
            String(request.terminalId || "")
        );
    });

    socket.on("disconnect", () => {
        for (const terminalId of terminals.keys()) {
            closeTerminal(terminalId);
        }
    });
});

server.listen(PORT, () => {
    console.log(
        `CorePanel is running at http://localhost:${PORT}`
    );

    console.log(
        `Detected platform: ${platform.name}`
    );
});
