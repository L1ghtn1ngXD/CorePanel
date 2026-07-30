const os = require("os");
const systemInformation = require("systeminformation");

let latestNetworkUsage = {
    download: 0,
    upload: 0,
    interfaceName: "Unavailable"
};

let selectedNetworkInterface = null;
let networkMonitorStarted = false;

function getWindowsName() {
    const release = os.release();
    const versionParts = release.split(".");
    const buildNumber = Number(versionParts[2]) || 0;

    if (release.startsWith("10.0") && buildNumber >= 22000) {
        return "Windows 11";
    }

    if (release.startsWith("10.0")) {
        return "Windows 10";
    }

    return `Windows ${release}`;
}

function selectSystemDisk(fileSystems) {
    if (!Array.isArray(fileSystems) || fileSystems.length === 0) {
        return null;
    }

    const systemDrive = String(
        process.env.SystemDrive || "C:"
    ).toUpperCase();

    return (
        fileSystems.find((disk) => {
            const mount = String(disk.mount || "").toUpperCase();

            return (
                mount === systemDrive ||
                mount === `${systemDrive}\\`
            );
        }) || fileSystems[0]
    );
}

function normalizeName(networkInterface) {
    return [
        networkInterface.iface,
        networkInterface.ifaceName,
        networkInterface.name,
        networkInterface.manufacturer,
        networkInterface.model
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function isVirtualInterface(networkInterface) {
    const name = normalizeName(networkInterface);

    const virtualNames = [
        "radmin",
        "vmware",
        "virtualbox",
        "hyper-v",
        "vethernet",
        "loopback",
        "bluetooth",
        "tailscale",
        "zerotier",
        "hamachi",
        "tap-windows",
        "wireguard",
        "wintun",
        "vpn",
        "pseudo"
    ];

    return (
        networkInterface.virtual === true ||
        networkInterface.internal === true ||
        virtualNames.some((word) => name.includes(word))
    );
}

function isActiveInterface(networkInterface) {
    return (
        String(networkInterface.operstate).toLowerCase() === "up" &&
        networkInterface.internal !== true
    );
}

function getInterfaceScore(networkInterface) {
    if (
        !isActiveInterface(networkInterface) ||
        isVirtualInterface(networkInterface)
    ) {
        return -10000;
    }

    const name = normalizeName(networkInterface);
    const interfaceName = String(
        networkInterface.iface || ""
    ).toLowerCase();

    let score = 0;

    if (interfaceName === "ethernet") {
        score += 1000;
    }

    if (interfaceName.startsWith("ethernet")) {
        score += 700;
    }

    if (interfaceName === "wi-fi" || interfaceName === "wifi") {
        score += 650;
    }

    const preferredNames = [
        "intel",
        "realtek",
        "broadcom",
        "killer",
        "qualcomm",
        "atheros",
        "marvell",
        "mediatek",
        "mediatek",
        "nvidia nforce",
        "mellanox",
        "aquantiа",
        "aquantia",
        "tp-link",
        "d-link"
    ];

    for (const preferredName of preferredNames) {
        if (name.includes(preferredName)) {
            score += 400;
            break;
        }
    }

    if (name.includes("ethernet")) {
        score += 300;
    }

    if (
        name.includes("wireless") ||
        name.includes("wi-fi") ||
        name.includes("wifi") ||
        name.includes("802.11")
    ) {
        score += 250;
    }

    if (networkInterface.default === true) {
        score += 500;
    }

    if (networkInterface.ip4) {
        score += 100;
    }

    return score;
}

async function selectNetworkInterface() {
    const interfaces =
        await systemInformation.networkInterfaces();

    if (!Array.isArray(interfaces) || interfaces.length === 0) {
        return null;
    }

    const sortedInterfaces = interfaces
        .map((networkInterface) => ({
            networkInterface,
            score: getInterfaceScore(networkInterface)
        }))
        .filter((item) => item.score >= 0)
        .sort((first, second) => second.score - first.score);

    return sortedInterfaces[0]?.networkInterface || null;
}

function getInterfaceIdentifier(networkInterface) {
    return (
        networkInterface?.iface ||
        networkInterface?.ifaceName ||
        null
    );
}

function normalizeTemperature(temperatureInformation) {
    const temperature = Number(
        temperatureInformation?.main
    );

    if (!Number.isFinite(temperature) || temperature <= 0) {
        return null;
    }

    return Number(temperature.toFixed(1));
}

async function updateNetworkUsage() {
    try {
        if (!selectedNetworkInterface) {
            selectedNetworkInterface =
                await selectNetworkInterface();
        }

        const interfaceIdentifier =
            getInterfaceIdentifier(selectedNetworkInterface);

        if (!interfaceIdentifier) {
            latestNetworkUsage = {
                download: 0,
                upload: 0,
                interfaceName: "Unavailable"
            };

            return;
        }

        const stats = await systemInformation.networkStats(
            interfaceIdentifier
        );

        const interfaceStats = Array.isArray(stats)
            ? stats[0]
            : null;

        if (!interfaceStats) {
            selectedNetworkInterface = null;
            return;
        }

        latestNetworkUsage = {
            download: Math.max(
                0,
                Number(interfaceStats.rx_sec) || 0
            ),

            upload: Math.max(
                0,
                Number(interfaceStats.tx_sec) || 0
            ),

            interfaceName: interfaceIdentifier
        };
    } catch (error) {
        console.error("Network monitoring error:", error);

        selectedNetworkInterface = null;

        latestNetworkUsage = {
            download: 0,
            upload: 0,
            interfaceName: "Unavailable"
        };
    }
}

function startNetworkMonitor() {
    if (networkMonitorStarted) {
        return;
    }

    networkMonitorStarted = true;

    updateNetworkUsage();

    const timer = setInterval(
        updateNetworkUsage,
        1000
    );

    timer.unref();
}

async function getSystemInfo() {
    const [
        cpuInformation,
        cpuLoad,
        cpuSpeed,
        memoryInformation,
        fileSystems,
        processInformation,
        temperatureInformation
    ] = await Promise.all([
        systemInformation.cpu(),
        systemInformation.currentLoad(),
        systemInformation.cpuCurrentSpeed(),
        systemInformation.mem(),
        systemInformation.fsSize(),
        systemInformation.processes(),
        systemInformation.cpuTemperature()
    ]);

    const systemDisk = selectSystemDisk(fileSystems);

    const cpuUsage = Math.max(
        0,
        Math.min(
            100,
            Number(cpuLoad.currentLoad) || 0
        )
    );

    const memoryUsage =
        memoryInformation.total > 0
            ? (
                memoryInformation.used /
                memoryInformation.total
            ) * 100
            : 0;

    const diskUsage = systemDisk
        ? Number(systemDisk.use) || 0
        : 0;

    return {
        operatingSystem: getWindowsName(),
        platform: os.platform(),
        architecture: os.arch(),
        kernel: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),

        cpu: {
            model:
                cpuInformation.brand ||
                os.cpus()[0]?.model ||
                "Unknown processor",

            manufacturer:
                cpuInformation.manufacturer ||
                "Unknown",

            physicalCores:
                Number(cpuInformation.physicalCores) || 0,

            logicalCores:
                Number(cpuInformation.cores) ||
                os.cpus().length,

            usage: Number(cpuUsage.toFixed(1)),

            speed: Number(
                (
                    Number(cpuSpeed.avg) ||
                    Number(cpuInformation.speed) ||
                    0
                ).toFixed(2)
            ),

            temperature:
                normalizeTemperature(
                    temperatureInformation
                )
        },

        memory: {
            total: Number(memoryInformation.total) || 0,
            used: Number(memoryInformation.used) || 0,
            free: Number(memoryInformation.free) || 0,

            usage: Number(
                Math.max(
                    0,
                    Math.min(100, memoryUsage)
                ).toFixed(1)
            )
        },

        disk: systemDisk
            ? {
                filesystem:
                    systemDisk.fs || "Unknown",

                mount:
                    systemDisk.mount || "Unknown",

                total:
                    Number(systemDisk.size) || 0,

                used:
                    Number(systemDisk.used) || 0,

                available:
                    Number(systemDisk.available) || 0,

                usage: Number(
                    Math.max(
                        0,
                        Math.min(100, diskUsage)
                    ).toFixed(1)
                )
            }
            : null,

        network: {
            download: latestNetworkUsage.download,
            upload: latestNetworkUsage.upload,
            interfaceName:
                latestNetworkUsage.interfaceName
        },

        processes: {
            total:
                Number(processInformation.all) || 0,

            running:
                Number(processInformation.running) || 0,

            sleeping:
                Number(processInformation.sleeping) || 0
        },

        timestamp: Date.now()
    };
}

startNetworkMonitor();

module.exports = {
    getSystemInfo
};