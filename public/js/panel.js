const navigationButtons = document.querySelectorAll(
    ".navigation-button"
);

const pages = document.querySelectorAll(
    "[data-page-content]"
);

const logoutButton =
    document.getElementById("logout-button");

const welcomeTitle =
    document.getElementById("welcome-title");

const currentUserElement =
    document.getElementById("current-user");

const currentPlatformElement =
    document.getElementById("current-platform");

const cpuRing =
    document.getElementById("cpu-ring");

const cpuUsageElement =
    document.getElementById("cpu-usage");

const cpuModelElement =
    document.getElementById("cpu-model");

const ramRing =
    document.getElementById("ram-ring");

const ramUsageElement =
    document.getElementById("ram-usage");

const ramValuesElement =
    document.getElementById("ram-values");

const diskRing =
    document.getElementById("disk-ring");

const diskUsageElement =
    document.getElementById("disk-usage");

const diskValuesElement =
    document.getElementById("disk-values");

const diskNameElement =
    document.getElementById("disk-name");

const networkDownloadElement =
    document.getElementById("network-download");

const networkUploadElement =
    document.getElementById("network-upload");

const cpuSpeedElement =
    document.getElementById("cpu-speed");

const cpuTemperatureElement =
    document.getElementById("cpu-temperature");

const processCountElement =
    document.getElementById("process-count");

const runningProcessesElement =
    document.getElementById("running-processes");

const systemOsElement =
    document.getElementById("system-os");

const systemKernelElement =
    document.getElementById("system-kernel");

const systemArchitectureElement =
    document.getElementById("system-architecture");

const systemHostnameElement =
    document.getElementById("system-hostname");

const physicalCoresElement =
    document.getElementById("physical-cores");

const systemCoresElement =
    document.getElementById("system-cores");

const systemUptimeElement =
    document.getElementById("system-uptime");

const diskMountElement =
    document.getElementById("disk-mount");

let systemInformationTimer = null;
let qemuInitialized = false;
let qemuLoading = false;
let qemuRefreshTimer = null;
let terminalInitialized = false;
let terminalSocket = null;
let activeTerminalId = null;
let terminalNumber = 0;

const terminalSessions = new Map();

async function requestJson(url, options = {}) {
    const response = await fetch(url, options);

    let data;

    try {
        data = await response.json();
    } catch {
        data = {
            message:
                "The server returned an invalid response."
        };
    }

    if (!response.ok) {
        throw new Error(
            data.message || "Request failed."
        );
    }

    return data;
}

function openPage(pageName) {
    navigationButtons.forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    pages.forEach((page) => {
        page.classList.toggle(
            "active",
            page.dataset.pageContent === pageName
        );
    });

    if (pageName === "system-info") {
        startSystemInformationUpdates();
    } else {
        stopSystemInformationUpdates();
    }

    if (pageName === "console") {
        initializeTerminal()
            .then(() => {
                fitActiveTerminal();
            })
            .catch((error) => {
                console.error(error);
            });
    }

    if (pageName === "qemu") {
        initializeQemuPage();
        loadQemuMachines();
        startQemuUpdates();
    } else {
        stopQemuUpdates();
    }
}

function formatBytes(bytes) {
    const value = Math.max(
        0,
        Number(bytes) || 0
    );

    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    if (value === 0) {
        return "0 B";
    }

    const unitIndex = Math.min(
        Math.floor(
            Math.log(value) / Math.log(1024)
        ),
        units.length - 1
    );

    const convertedValue =
        value / Math.pow(1024, unitIndex);

    const decimals =
        unitIndex >= 3 ? 1 : 0;

    return (
        `${convertedValue.toFixed(decimals)} ` +
        units[unitIndex]
    );
}

function formatNetworkSpeed(bytesPerSecond) {
    return `${formatBytes(bytesPerSecond)}/s`;
}

function formatUptime(seconds) {
    const totalSeconds = Math.max(
        0,
        Math.floor(Number(seconds) || 0)
    );

    const days =
        Math.floor(totalSeconds / 86400);

    const hours =
        Math.floor(
            (totalSeconds % 86400) / 3600
        );

    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );

    const result = [];

    if (days > 0) {
        result.push(`${days}d`);
    }

    if (hours > 0 || days > 0) {
        result.push(`${hours}h`);
    }

    result.push(`${minutes}m`);

    return result.join(" ");
}

function updateUsageRing(ring, percentage) {
    if (!ring) {
        return;
    }

    const safePercentage = Math.max(
        0,
        Math.min(
            100,
            Number(percentage) || 0
        )
    );

    ring.style.setProperty(
        "--usage",
        `${safePercentage * 3.6}deg`
    );
}

function formatTemperature(temperature) {
    if (
        temperature === null ||
        temperature === undefined ||
        Number(temperature) <= 0
    ) {
        return "Unavailable";
    }

    return `${Number(temperature).toFixed(1)} °C`;
}

function formatCpuSpeed(speed) {
    const numericSpeed = Number(speed);

    if (
        !Number.isFinite(numericSpeed) ||
        numericSpeed <= 0
    ) {
        return "Unavailable";
    }

    return `${numericSpeed.toFixed(2)} GHz`;
}

async function loadSystemInformation() {
    try {
        const information = await requestJson(
            "/api/system/info"
        );

        cpuUsageElement.textContent =
            `${information.cpu.usage}%`;

        cpuModelElement.textContent =
            information.cpu.model;

        updateUsageRing(
            cpuRing,
            information.cpu.usage
        );

        ramUsageElement.textContent =
            `${information.memory.usage}%`;

        ramValuesElement.textContent =
            `${formatBytes(information.memory.used)} / ` +
            `${formatBytes(information.memory.total)}`;

        updateUsageRing(
            ramRing,
            information.memory.usage
        );

        if (information.disk) {
            diskUsageElement.textContent =
                `${information.disk.usage}%`;

            diskValuesElement.textContent =
                `${formatBytes(information.disk.used)} / ` +
                `${formatBytes(information.disk.total)}`;

            diskNameElement.textContent =
                information.disk.filesystem ||
                "System disk";

            diskMountElement.textContent =
                information.disk.mount;

            updateUsageRing(
                diskRing,
                information.disk.usage
            );
        } else {
            diskUsageElement.textContent = "N/A";
            diskValuesElement.textContent = "Unavailable";
            diskNameElement.textContent = "System disk";
            diskMountElement.textContent = "Unavailable";

            updateUsageRing(diskRing, 0);
        }

        networkDownloadElement.textContent =
            formatNetworkSpeed(
                information.network.download
            );

        networkUploadElement.textContent =
            formatNetworkSpeed(
                information.network.upload
            );

        cpuSpeedElement.textContent =
            formatCpuSpeed(
                information.cpu.speed
            );

        cpuTemperatureElement.textContent =
            formatTemperature(
                information.cpu.temperature
            );

        processCountElement.textContent =
            information.processes.total;

        runningProcessesElement.textContent =
            information.processes.running;

        systemOsElement.textContent =
            information.operatingSystem;

        systemKernelElement.textContent =
            information.kernel;

        systemArchitectureElement.textContent =
            information.architecture;

        systemHostnameElement.textContent =
            information.hostname;

        physicalCoresElement.textContent =
            information.cpu.physicalCores;

        systemCoresElement.textContent =
            information.cpu.logicalCores;

        systemUptimeElement.textContent =
            formatUptime(information.uptime);
    } catch (error) {
        console.error(
            "Failed to load system information:",
            error
        );
    }
}

function startSystemInformationUpdates() {
    if (systemInformationTimer !== null) {
        return;
    }

    loadSystemInformation();

    systemInformationTimer =
        window.setInterval(
            loadSystemInformation,
            2000
        );
}

function stopSystemInformationUpdates() {
    if (systemInformationTimer === null) {
        return;
    }

    window.clearInterval(
        systemInformationTimer
    );

    systemInformationTimer = null;
}

function loadStyleSheet(url) {
    return new Promise((resolve, reject) => {
        if (
            document.querySelector(
                `link[href="${url}"]`
            )
        ) {
            resolve();
            return;
        }

        const link = document.createElement("link");

        link.rel = "stylesheet";
        link.href = url;
        link.onload = resolve;
        link.onerror = reject;

        document.head.appendChild(link);
    });
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        if (
            document.querySelector(
                `script[src="${url}"]`
            )
        ) {
            resolve();
            return;
        }

        const script = document.createElement("script");

        script.src = url;
        script.onload = resolve;
        script.onerror = reject;

        document.body.appendChild(script);
    });
}

function createTerminalLayout() {
    const consolePage = document.querySelector(
        '[data-page-content="console"]'
    );

    consolePage.innerHTML = `
        <div class="terminal-page">
            <div class="terminal-header">
                <div>
                    <p class="page-eyebrow">Terminal</p>
                    <h2>Console</h2>
                </div>

                <button
                    id="terminal-new-button"
                    class="terminal-new-button"
                    type="button"
                >
                    New terminal
                </button>
            </div>

            <div class="terminal-container">
                <div
                    id="terminal-tabs"
                    class="terminal-tabs"
                ></div>

                <div
                    id="terminal-views"
                    class="terminal-views"
                >
                    <div
                        id="terminal-empty"
                        class="terminal-empty visible"
                    >
                        No terminal sessions.
                    </div>
                </div>
            </div>
        </div>
    `;

    document
        .getElementById("terminal-new-button")
        .addEventListener(
            "click",
            createTerminalSession
        );
}

function generateTerminalId() {
    if (window.crypto?.randomUUID) {
        return window.crypto
            .randomUUID()
            .replaceAll("-", "");
    }

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .slice(2)
    );
}

function updateTerminalEmptyState() {
    const emptyElement =
        document.getElementById("terminal-empty");

    if (!emptyElement) {
        return;
    }

    emptyElement.classList.toggle(
        "visible",
        terminalSessions.size === 0
    );
}

function activateTerminal(terminalId) {
    const session =
        terminalSessions.get(terminalId);

    if (!session) {
        return;
    }

    activeTerminalId = terminalId;

    for (const [
        currentId,
        currentSession
    ] of terminalSessions) {
        currentSession.tab.classList.toggle(
            "active",
            currentId === terminalId
        );

        currentSession.view.classList.toggle(
            "active",
            currentId === terminalId
        );
    }

    window.setTimeout(() => {
        session.fitAddon.fit();

        terminalSocket.emit(
            "terminal:resize",
            {
                terminalId,
                columns: session.terminal.cols,
                rows: session.terminal.rows
            }
        );

        session.terminal.focus();
    }, 0);
}

function fitActiveTerminal() {
    if (!activeTerminalId) {
        return;
    }

    const session =
        terminalSessions.get(activeTerminalId);

    if (!session) {
        return;
    }

    window.setTimeout(() => {
        session.fitAddon.fit();

        terminalSocket.emit(
            "terminal:resize",
            {
                terminalId: activeTerminalId,
                columns: session.terminal.cols,
                rows: session.terminal.rows
            }
        );
    }, 0);
}

function closeTerminalSession(terminalId) {
    const session =
        terminalSessions.get(terminalId);

    if (!session) {
        return;
    }

    terminalSocket.emit(
        "terminal:close",
        {
            terminalId
        }
    );

    session.terminal.dispose();
    session.tab.remove();
    session.view.remove();

    terminalSessions.delete(terminalId);

    if (activeTerminalId === terminalId) {
        const remainingIds =
            Array.from(terminalSessions.keys());

        activeTerminalId =
            remainingIds.at(-1) || null;

        if (activeTerminalId) {
            activateTerminal(activeTerminalId);
        }
    }

    updateTerminalEmptyState();
}

function createTerminalSession() {
    if (
        !terminalInitialized ||
        !terminalSocket?.connected ||
        terminalSessions.size >= 8
    ) {
        return;
    }

    terminalNumber += 1;

    const terminalId = generateTerminalId();
    const title = `Terminal ${terminalNumber}`;

    const terminalTabs =
        document.getElementById("terminal-tabs");

    const terminalViews =
        document.getElementById("terminal-views");

    const tab = document.createElement("div");

    tab.className = "terminal-tab";

    tab.innerHTML = `
        <button
            class="terminal-tab-select"
            type="button"
        ></button>

        <button
            class="terminal-tab-close"
            type="button"
            aria-label="Close terminal"
        >
            ×
        </button>
    `;

    tab.querySelector(
        ".terminal-tab-select"
    ).textContent = title;

    const view = document.createElement("div");

    view.className = "terminal-view";

    const terminal = new Terminal({
        cursorBlink: true,
        convertEol: false,
        fontFamily:
            '"Cascadia Mono", "Consolas", monospace',
        fontSize: 14,
        lineHeight: 1.15,
        scrollback: 5000,
        allowTransparency: true,
        theme: {
            background: "#0c0c0c",
            foreground: "#f0f0f0",
            cursor: "#f0f0f0",
            cursorAccent: "#0c0c0c",
            selectionBackground: "#4a4a4a",
            black: "#0c0c0c",
            red: "#c50f1f",
            green: "#13a10e",
            yellow: "#c19c00",
            blue: "#0037da",
            magenta: "#881798",
            cyan: "#3a96dd",
            white: "#cccccc",
            brightBlack: "#767676",
            brightRed: "#e74856",
            brightGreen: "#16c60c",
            brightYellow: "#f9f1a5",
            brightBlue: "#3b78ff",
            brightMagenta: "#b4009e",
            brightCyan: "#61d6d6",
            brightWhite: "#f2f2f2"
        }
    });

    const fitAddon =
        new FitAddon.FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(view);

    terminal.onData((data) => {
        terminalSocket.emit(
            "terminal:input",
            {
                terminalId,
                data
            }
        );
    });

    terminalSessions.set(
        terminalId,
        {
            terminal,
            fitAddon,
            tab,
            view
        }
    );

    tab.querySelector(
        ".terminal-tab-select"
    ).addEventListener(
        "click",
        () => {
            activateTerminal(terminalId);
        }
    );

    tab.querySelector(
        ".terminal-tab-close"
    ).addEventListener(
        "click",
        () => {
            closeTerminalSession(terminalId);
        }
    );

    terminalTabs.appendChild(tab);
    terminalViews.appendChild(view);

    updateTerminalEmptyState();
    activateTerminal(terminalId);

    fitAddon.fit();

    terminalSocket.emit(
        "terminal:create",
        {
            terminalId,
            columns: terminal.cols,
            rows: terminal.rows
        }
    );
}

async function initializeTerminal() {
    if (terminalInitialized) {
        return;
    }

    await Promise.all([
        loadStyleSheet(
            "/vendor/xterm/css/xterm.css"
        ),
        loadStyleSheet(
            "/css/terminal.css"
        )
    ]);

    await loadScript(
        "/vendor/xterm/lib/xterm.js"
    );

    await loadScript(
        "/vendor/xterm-addon-fit/lib/addon-fit.js"
    );

    await loadScript(
        "/socket.io/socket.io.js"
    );

    createTerminalLayout();

    terminalSocket = io();

    terminalSocket.on(
        "connect",
        () => {
            if (terminalSessions.size === 0) {
                createTerminalSession();
            }
        }
    );

    terminalSocket.on(
        "terminal:data",
        (response) => {
            const session =
                terminalSessions.get(
                    response.terminalId
                );

            if (!session) {
                return;
            }

            session.terminal.write(
                response.data
            );
        }
    );

    terminalSocket.on(
        "terminal:error",
        (response) => {
            const session =
                terminalSessions.get(
                    response.terminalId
                );

            if (session) {
                session.terminal.writeln(
                    `\r\n\x1b[31m${response.message}\x1b[0m`
                );
            }
        }
    );

    terminalSocket.on(
        "terminal:exit",
        (response) => {
            const session =
                terminalSessions.get(
                    response.terminalId
                );

            if (!session) {
                return;
            }

            session.terminal.writeln(
                `\r\n\x1b[90mProcess exited with code ${response.exitCode}.\x1b[0m`
            );
        }
    );

    terminalSocket.on(
        "connect_error",
        () => {
            window.location.replace("/");
        }
    );

    window.addEventListener(
        "resize",
        fitActiveTerminal
    );

    terminalInitialized = true;
}


function escapeHtml(value) {
    return String(value || "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

function formatQemuMemory(bytes) {
    const value =
        Number(bytes) || 0;

    if (
        value >=
        1024 ** 3
    ) {
        return (
            (
                value /
                1024 ** 3
            ).toFixed(1) +
            " GB"
        );
    }

    return (
        Math.round(
            value /
            1024 ** 2
        ) +
        " MB"
    );
}

function initializeQemuPage() {
    if (qemuInitialized) {
        return;
    }

    const page =
        document.querySelector(
            '[data-page-content="qemu"]'
        );

    if (!page) {
        return;
    }

    page.innerHTML = `
        <div class="page-kicker">VIRTUALIZATION</div>
        <div class="qemu-heading-row">
            <h1>QEMU</h1>
            <button
                id="qemu-refresh-button"
                class="secondary-button"
                type="button"
            >
                Refresh
            </button>
        </div>

        <div
            id="qemu-message"
            class="qemu-message"
        >
            Loading virtual machines...
        </div>

        <div
            id="qemu-machine-grid"
            class="qemu-machine-grid"
        ></div>
    `;

    if (
        !document.getElementById(
            "qemu-runtime-style"
        )
    ) {
        const style =
            document.createElement(
                "style"
            );

        style.id =
            "qemu-runtime-style";

        style.textContent = `
            .qemu-heading-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 24px;
            }

            .qemu-heading-row h1 {
                margin: 0;
            }

            .qemu-message {
                min-height: 160px;
                border: 1px solid #303030;
                background: #1d1d1d;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 28px;
                color: #a9a9a9;
                text-align: center;
            }

            .qemu-message.hidden {
                display: none;
            }

            .qemu-machine-grid {
                display: grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(
                            340px,
                            1fr
                        )
                    );
                gap: 14px;
            }

            .qemu-machine-card {
                border: 1px solid #303030;
                background: #1d1d1d;
                padding: 18px;
            }

            .qemu-machine-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 18px;
            }

            .qemu-machine-name {
                font-size: 18px;
                font-weight: 600;
                overflow-wrap: anywhere;
            }

            .qemu-machine-uuid {
                margin-top: 5px;
                color: #777;
                font-size: 11px;
                overflow-wrap: anywhere;
            }

            .qemu-state {
                white-space: nowrap;
                font-size: 12px;
            }

            .qemu-state::before {
                content: "";
                display: inline-block;
                width: 7px;
                height: 7px;
                margin-right: 7px;
                border-radius: 50%;
                background: #d67b7b;
            }

            .qemu-state.running::before {
                background: #8ed09a;
            }

            .qemu-state.paused::before {
                background: #d9c17f;
            }

            .qemu-details {
                display: grid;
                grid-template-columns:
                    repeat(
                        3,
                        minmax(
                            0,
                            1fr
                        )
                    );
                border-top: 1px solid #303030;
                border-bottom: 1px solid #303030;
                margin-bottom: 16px;
            }

            .qemu-detail {
                padding: 13px 8px;
                border-right: 1px solid #303030;
            }

            .qemu-detail:last-child {
                border-right: 0;
            }

            .qemu-detail-label {
                color: #7f7f7f;
                font-size: 10px;
                margin-bottom: 5px;
            }

            .qemu-detail-value {
                font-size: 13px;
                overflow-wrap: anywhere;
            }

            .qemu-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 7px;
            }

            .qemu-actions button {
                min-height: 32px;
            }

            .qemu-autostart {
                display: flex;
                align-items: center;
                gap: 7px;
                margin-left: auto;
                color: #b6b6b6;
                font-size: 12px;
            }

            .qemu-danger {
                border-color: #573232 !important;
                background: #3a2323 !important;
            }

            @media (max-width: 700px) {
                .qemu-machine-grid {
                    grid-template-columns: 1fr;
                }

                .qemu-details {
                    grid-template-columns: 1fr;
                }

                .qemu-detail {
                    border-right: 0;
                    border-bottom: 1px solid #303030;
                }

                .qemu-detail:last-child {
                    border-bottom: 0;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    document
        .getElementById(
            "qemu-refresh-button"
        )
        ?.addEventListener(
            "click",
            loadQemuMachines
        );

    document
        .getElementById(
            "qemu-machine-grid"
        )
        ?.addEventListener(
            "click",
            handleQemuActionClick
        );

    document
        .getElementById(
            "qemu-machine-grid"
        )
        ?.addEventListener(
            "change",
            handleQemuAutostartChange
        );

    qemuInitialized = true;
}

function renderQemuMachines(
    machines
) {
    const grid =
        document.getElementById(
            "qemu-machine-grid"
        );

    const message =
        document.getElementById(
            "qemu-message"
        );

    if (
        !grid ||
        !message
    ) {
        return;
    }

    if (
        !Array.isArray(machines) ||
        machines.length === 0
    ) {
        grid.innerHTML = "";
        message.textContent =
            "No virtual machines were found. Create a libvirt virtual machine and press Refresh.";
        message.classList.remove(
            "hidden"
        );
        return;
    }

    message.classList.add(
        "hidden"
    );

    grid.innerHTML =
        machines.map(
            (machine) => {
                const encodedName =
                    encodeURIComponent(
                        machine.name
                    );

                const running =
                    machine.state ===
                    "Running";

                const paused =
                    machine.state ===
                    "Paused";

                const stateClass =
                    running
                        ? "running"
                        : paused
                            ? "paused"
                            : "";

                const startDisabled =
                    running ||
                    paused;

                const runningDisabled =
                    !running;

                const resumeDisabled =
                    !paused;

                return `
                    <article
                        class="qemu-machine-card"
                        data-machine-name="${escapeHtml(
                            machine.name
                        )}"
                    >
                        <div class="qemu-machine-header">
                            <div>
                                <div class="qemu-machine-name">
                                    ${escapeHtml(
                                        machine.name
                                    )}
                                </div>
                                <div class="qemu-machine-uuid">
                                    ${escapeHtml(
                                        machine.uuid ||
                                        "No UUID"
                                    )}
                                </div>
                            </div>

                            <div class="qemu-state ${stateClass}">
                                ${escapeHtml(
                                    machine.state
                                )}
                            </div>
                        </div>

                        <div class="qemu-details">
                            <div class="qemu-detail">
                                <div class="qemu-detail-label">
                                    VIRTUAL CPUs
                                </div>
                                <div class="qemu-detail-value">
                                    ${Number(
                                        machine.vcpus
                                    ) || 0}
                                </div>
                            </div>

                            <div class="qemu-detail">
                                <div class="qemu-detail-label">
                                    MEMORY
                                </div>
                                <div class="qemu-detail-value">
                                    ${formatQemuMemory(
                                        machine.memoryBytes
                                    )}
                                </div>
                            </div>

                            <div class="qemu-detail">
                                <div class="qemu-detail-label">
                                    AUTOSTART
                                </div>
                                <div class="qemu-detail-value">
                                    ${machine.autostart
                                        ? "Enabled"
                                        : "Disabled"}
                                </div>
                            </div>
                        </div>

                        <div class="qemu-actions">
                            <button
                                type="button"
                                data-qemu-action="start"
                                data-machine="${escapeHtml(
                                    machine.name
                                )}"
                                ${startDisabled
                                    ? "disabled"
                                    : ""}
                            >
                                Start
                            </button>

                            <button
                                type="button"
                                data-qemu-action="shutdown"
                                data-machine="${escapeHtml(
                                    machine.name
                                )}"
                                ${runningDisabled
                                    ? "disabled"
                                    : ""}
                            >
                                Shutdown
                            </button>

                            <button
                                type="button"
                                data-qemu-action="reboot"
                                data-machine="${escapeHtml(
                                    machine.name
                                )}"
                                ${runningDisabled
                                    ? "disabled"
                                    : ""}
                            >
                                Reboot
                            </button>

                            <button
                                type="button"
                                data-qemu-action="reset"
                                data-machine="${escapeHtml(
                                    machine.name
                                )}"
                                ${runningDisabled
                                    ? "disabled"
                                    : ""}
                            >
                                Reset
                            </button>

                            <button
                                type="button"
                                data-qemu-action="suspend"
                                data-machine="${escapeHtml(
                                    machine.name
                                )}"
                                ${runningDisabled
                                    ? "disabled"
                                    : ""}
                            >
                                Suspend
                            </button>

                            <button
                                type="button"
                                data-qemu-action="resume"
                                data-machine="${escapeHtml(
                                    machine.name
                                )}"
                                ${resumeDisabled
                                    ? "disabled"
                                    : ""}
                            >
                                Resume
                            </button>

                            <button
                                type="button"
                                class="qemu-danger"
                                data-qemu-action="destroy"
                                data-machine="${escapeHtml(
                                    machine.name
                                )}"
                                ${runningDisabled
                                    ? "disabled"
                                    : ""}
                            >
                                Force Off
                            </button>

                            <label class="qemu-autostart">
                                <input
                                    type="checkbox"
                                    data-qemu-autostart
                                    data-machine="${escapeHtml(
                                        machine.name
                                    )}"
                                    ${machine.autostart
                                        ? "checked"
                                        : ""}
                                >
                                Autostart
                            </label>
                        </div>
                    </article>
                `;
            }
        ).join("");
}

async function loadQemuMachines() {
    initializeQemuPage();

    if (qemuLoading) {
        return;
    }

    qemuLoading = true;

    const refreshButton =
        document.getElementById(
            "qemu-refresh-button"
        );

    const message =
        document.getElementById(
            "qemu-message"
        );

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    if (message) {
        message.textContent =
            "Loading virtual machines...";
        message.classList.remove(
            "hidden"
        );
    }

    try {
        const result =
            await requestJson(
                "/api/qemu/machines"
            );

        renderQemuMachines(
            result.machines
        );
    } catch (error) {
        const grid =
            document.getElementById(
                "qemu-machine-grid"
            );

        if (grid) {
            grid.innerHTML = "";
        }

        if (message) {
            message.textContent =
                error.message;
            message.classList.remove(
                "hidden"
            );
        }
    } finally {
        qemuLoading = false;

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}

async function handleQemuActionClick(
    event
) {
    const button =
        event.target.closest(
            "[data-qemu-action]"
        );

    if (!button) {
        return;
    }

    const machineName =
        button.dataset.machine;

    const action =
        button.dataset.qemuAction;

    if (
        !machineName ||
        !action
    ) {
        return;
    }

    if (
        action === "destroy" &&
        !window.confirm(
            `Force power off "${machineName}"? Unsaved guest data may be lost.`
        )
    ) {
        return;
    }

    button.disabled = true;

    try {
        await requestJson(
            `/api/qemu/machines/${encodeURIComponent(
                machineName
            )}/${encodeURIComponent(
                action
            )}`,
            {
                method: "POST"
            }
        );

        window.setTimeout(
            loadQemuMachines,
            700
        );
    } catch (error) {
        window.alert(
            error.message
        );
        button.disabled = false;
    }
}

async function handleQemuAutostartChange(
    event
) {
    const checkbox =
        event.target.closest(
            "[data-qemu-autostart]"
        );

    if (!checkbox) {
        return;
    }

    const machineName =
        checkbox.dataset.machine;

    checkbox.disabled = true;

    try {
        await requestJson(
            `/api/qemu/machines/${encodeURIComponent(
                machineName
            )}/autostart`,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify({
                        enabled:
                            checkbox.checked
                    })
            }
        );

        await loadQemuMachines();
    } catch (error) {
        checkbox.checked =
            !checkbox.checked;

        window.alert(
            error.message
        );
    } finally {
        checkbox.disabled = false;
    }
}

function startQemuUpdates() {
    stopQemuUpdates();

    qemuRefreshTimer =
        window.setInterval(
            loadQemuMachines,
            5000
        );
}

function stopQemuUpdates() {
    if (
        qemuRefreshTimer !== null
    ) {
        window.clearInterval(
            qemuRefreshTimer
        );

        qemuRefreshTimer = null;
    }
}

async function loadPanelInformation() {
    try {
        const [
            user,
            platformInformation
        ] = await Promise.all([
            requestJson("/api/auth/me"),
            requestJson("/api/platform")
        ]);

        currentUserElement.textContent =
            user.username;

        currentPlatformElement.textContent =
            platformInformation.platform;

        welcomeTitle.textContent =
            `Welcome, ${user.username}`;
    } catch {
        window.location.replace("/");
    }
}

navigationButtons.forEach((button) => {
    button.addEventListener("click", () => {
        openPage(button.dataset.page);
    });
});

logoutButton.addEventListener(
    "click",
    async () => {
        logoutButton.disabled = true;

        if (terminalSocket) {
            terminalSocket.disconnect();
        }

        try {
            await requestJson(
                "/api/auth/logout",
                {
                    method: "POST"
                }
            );
        } finally {
            window.location.replace("/");
        }
    }
);

loadPanelInformation();