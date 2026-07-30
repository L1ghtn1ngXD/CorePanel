const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync =
    promisify(execFile);

const CPU_SAMPLE_DELAY =
    250;

const NETWORK_SAMPLE_DELAY =
    500;

function wait(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(
            resolve,
            milliseconds
        );
    });
}

function parseKeyValueFile(content) {
    const result = {};

    for (
        const rawLine of
        String(content || "")
            .split(/\r?\n/)
    ) {
        const line =
            rawLine.trim();

        if (
            !line ||
            line.startsWith("#")
        ) {
            continue;
        }

        const separatorIndex =
            line.indexOf("=");

        if (separatorIndex < 1) {
            continue;
        }

        const key =
            line
                .slice(
                    0,
                    separatorIndex
                )
                .trim();

        let value =
            line
                .slice(
                    separatorIndex + 1
                )
                .trim();

        if (
            value.length >= 2 &&
            (
                (
                    value.startsWith('"') &&
                    value.endsWith('"')
                ) ||
                (
                    value.startsWith("'") &&
                    value.endsWith("'")
                )
            )
        ) {
            value =
                value.slice(
                    1,
                    -1
                );
        }

        result[key] =
            value;
    }

    return result;
}

async function readTextFile(
    filePath,
    fallback = ""
) {
    try {
        return String(
            await fs.promises.readFile(
                filePath,
                "utf8"
            )
        ).trim();
    } catch {
        return fallback;
    }
}

function capitalizeWords(value) {
    return String(value || "")
        .replace(
            /(^|[\s._-])([a-z])/g,
            (match, prefix, letter) =>
                prefix +
                letter.toUpperCase()
        );
}

function createDistributionName(
    release
) {
    const name =
        release.NAME ||
        release.ID ||
        "Linux";

    const version =
        release.VERSION_ID ||
        "";

    const codename =
        release.VERSION_CODENAME ||
        release.DEBIAN_CODENAME ||
        "";

    if (
        version &&
        codename
    ) {
        return (
            `${name} ${version} ` +
            `(${capitalizeWords(codename)})`
        );
    }

    if (version) {
        return `${name} ${version}`;
    }

    if (release.PRETTY_NAME) {
        return release.PRETTY_NAME;
    }

    return name;
}

async function getDistributionInformation() {
    const content =
        await readTextFile(
            "/etc/os-release"
        );

    const release =
        parseKeyValueFile(
            content
        );

    const displayName =
        createDistributionName(
            release
        );

    return {
        id:
            release.ID ||
            "linux",

        idLike:
            release.ID_LIKE ||
            "",

        name:
            release.NAME ||
            "Linux",

        version:
            release.VERSION_ID ||
            "",

        codename:
            release.VERSION_CODENAME ||
            release.DEBIAN_CODENAME ||
            "",

        prettyName:
            release.PRETTY_NAME ||
            displayName,

        displayName,

        homeUrl:
            release.HOME_URL ||
            "",

        supportUrl:
            release.SUPPORT_URL ||
            ""
    };
}

async function readCpuSnapshot() {
    const content =
        await fs.promises.readFile(
            "/proc/stat",
            "utf8"
        );

    const cpuLine =
        String(content)
            .split(/\r?\n/)
            .find(
                (line) =>
                    line.startsWith(
                        "cpu "
                    )
            );

    if (!cpuLine) {
        throw new Error(
            "CPU statistics are unavailable."
        );
    }

    const values =
        cpuLine
            .trim()
            .split(/\s+/)
            .slice(1)
            .map(
                (value) =>
                    Number(value) || 0
            );

    const [
        user,
        nice,
        system,
        idle,
        iowait,
        irq,
        softirq,
        steal
    ] = values;

    return {
        idle:
            idle +
            iowait,

        total:
            user +
            nice +
            system +
            idle +
            iowait +
            irq +
            softirq +
            steal
    };
}

async function getCpuUsage() {
    const first =
        await readCpuSnapshot();

    await wait(
        CPU_SAMPLE_DELAY
    );

    const second =
        await readCpuSnapshot();

    const idleDifference =
        second.idle -
        first.idle;

    const totalDifference =
        second.total -
        first.total;

    if (
        totalDifference <= 0
    ) {
        return 0;
    }

    const usage =
        (
            1 -
            idleDifference /
            totalDifference
        ) * 100;

    return Math.max(
        0,
        Math.min(
            100,
            Number(
                usage.toFixed(1)
            )
        )
    );
}

async function getCpuFrequency() {
    const cpuInfo =
        await readTextFile(
            "/proc/cpuinfo"
        );

    const matches =
        Array.from(
            cpuInfo.matchAll(
                /^cpu MHz\s*:\s*([\d.]+)/gmi
            )
        );

    if (
        matches.length > 0
    ) {
        const frequencies =
            matches
                .map(
                    (match) =>
                        Number(match[1])
                )
                .filter(
                    Number.isFinite
                );

        if (
            frequencies.length > 0
        ) {
            const average =
                frequencies.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                frequencies.length;

            const ghz =
                average /
                1000;

            return {
                mhz:
                    Number(
                        average.toFixed(0)
                    ),

                ghz:
                    Number(
                        ghz.toFixed(2)
                    ),

                display:
                    `${ghz.toFixed(2)} GHz`
            };
        }
    }

    const currentFrequency =
        Number(
            await readTextFile(
                "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq",
                "0"
            )
        );

    if (
        currentFrequency > 0
    ) {
        const mhz =
            currentFrequency /
            1000;

        const ghz =
            mhz /
            1000;

        return {
            mhz:
                Number(
                    mhz.toFixed(0)
                ),

            ghz:
                Number(
                    ghz.toFixed(2)
                ),

            display:
                `${ghz.toFixed(2)} GHz`
        };
    }

    return {
        mhz: 0,
        ghz: 0,
        display:
            "Unavailable"
    };
}

async function getCpuTemperature() {
    const thermalRoot =
        "/sys/class/thermal";

    let entries;

    try {
        entries =
            await fs.promises.readdir(
                thermalRoot,
                {
                    withFileTypes: true
                }
            );
    } catch {
        return null;
    }

    const temperatures = [];

    for (
        const entry of
        entries
    ) {
        if (
            !entry.isDirectory() ||
            !entry.name.startsWith(
                "thermal_zone"
            )
        ) {
            continue;
        }

        const temperature =
            Number(
                await readTextFile(
                    path.join(
                        thermalRoot,
                        entry.name,
                        "temp"
                    ),
                    "0"
                )
            );

        if (
            temperature <= 0
        ) {
            continue;
        }

        const celsius =
            temperature > 1000
                ? temperature / 1000
                : temperature;

        if (
            celsius > 0 &&
            celsius < 150
        ) {
            temperatures.push(
                celsius
            );
        }
    }

    if (
        temperatures.length === 0
    ) {
        return null;
    }

    return Number(
        Math.max(
            ...temperatures
        ).toFixed(1)
    );
}

async function getRootDisk() {
    try {
        const {
            stdout
        } = await execFileAsync(
            "df",
            [
                "-B1",
                "-P",
                "/"
            ],
            {
                encoding: "utf8",
                timeout: 5000
            }
        );

        const lines =
            String(stdout)
                .trim()
                .split(/\r?\n/);

        const fields =
            lines[
                lines.length - 1
            ]
                .trim()
                .split(/\s+/);

        const total =
            Number(fields[1]) || 0;

        const used =
            Number(fields[2]) || 0;

        const free =
            Number(fields[3]) || 0;

        const usage =
            total > 0
                ? Number(
                    (
                        used /
                        total *
                        100
                    ).toFixed(1)
                )
                : 0;

        return {
            device:
                fields[0] ||
                "",

            mount:
                fields[5] ||
                "/",

            total,
            used,
            free,
            usage
        };
    } catch {
        return {
            device: "",
            mount: "/",
            total: 0,
            used: 0,
            free: 0,
            usage: 0
        };
    }
}

async function readNetworkSnapshot() {
    const content =
        await fs.promises.readFile(
            "/proc/net/dev",
            "utf8"
        );

    let received = 0;
    let transmitted = 0;

    for (
        const line of
        String(content)
            .split(/\r?\n/)
    ) {
        if (!line.includes(":")) {
            continue;
        }

        const [
            interfacePart,
            dataPart
        ] = line.split(":");

        const interfaceName =
            interfacePart.trim();

        if (
            !interfaceName ||
            interfaceName === "lo"
        ) {
            continue;
        }

        const fields =
            dataPart
                .trim()
                .split(/\s+/)
                .map(
                    (value) =>
                        Number(value) || 0
                );

        received +=
            fields[0] || 0;

        transmitted +=
            fields[8] || 0;
    }

    return {
        received,
        transmitted
    };
}

async function getNetworkSpeed() {
    const first =
        await readNetworkSnapshot();

    const startedAt =
        Date.now();

    await wait(
        NETWORK_SAMPLE_DELAY
    );

    const second =
        await readNetworkSnapshot();

    const elapsedSeconds =
        Math.max(
            0.001,
            (
                Date.now() -
                startedAt
            ) / 1000
        );

    return {
        download:
            Math.max(
                0,
                Math.round(
                    (
                        second.received -
                        first.received
                    ) /
                    elapsedSeconds
                )
            ),

        upload:
            Math.max(
                0,
                Math.round(
                    (
                        second.transmitted -
                        first.transmitted
                    ) /
                    elapsedSeconds
                )
            )
    };
}

async function getProcessCounts() {
    let entries;

    try {
        entries =
            await fs.promises.readdir(
                "/proc",
                {
                    withFileTypes: true
                }
            );
    } catch {
        return {
            total: 0,
            running: 0
        };
    }

    const processIds =
        entries
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    /^\d+$/.test(
                        entry.name
                    )
            )
            .map(
                (entry) =>
                    entry.name
            );

    let running = 0;

    await Promise.all(
        processIds.map(
            async (processId) => {
                try {
                    const stat =
                        await fs.promises.readFile(
                            path.join(
                                "/proc",
                                processId,
                                "stat"
                            ),
                            "utf8"
                        );

                    const closingParenthesis =
                        stat.lastIndexOf(
                            ")"
                        );

                    const state =
                        stat
                            .slice(
                                closingParenthesis + 2
                            )
                            .split(/\s+/)[0];

                    if (state === "R") {
                        running += 1;
                    }
                } catch {
                }
            }
        )
    );

    return {
        total:
            processIds.length,

        running
    };
}

function getPrimaryNetworkAddress() {
    const interfaces =
        os.networkInterfaces();

    for (
        const [
            interfaceName,
            addresses
        ] of Object.entries(
            interfaces
        )
    ) {
        for (
            const address of
            addresses || []
        ) {
            if (
                address.family ===
                    "IPv4" &&
                !address.internal
            ) {
                return {
                    interface:
                        interfaceName,

                    address:
                        address.address,

                    netmask:
                        address.netmask,

                    mac:
                        address.mac,

                    cidr:
                        address.cidr
                };
            }
        }
    }

    return {
        interface: "",
        address: "",
        netmask: "",
        mac: "",
        cidr: ""
    };
}

async function getVirtualization() {
    const productName =
        await readTextFile(
            "/sys/class/dmi/id/product_name"
        );

    const systemVendor =
        await readTextFile(
            "/sys/class/dmi/id/sys_vendor"
        );

    const combined =
        `${productName} ${systemVendor}`
            .toLowerCase();

    let type =
        "Physical machine";

    if (
        combined.includes("kvm") ||
        combined.includes("qemu")
    ) {
        type =
            "KVM/QEMU";
    } else if (
        combined.includes("vmware")
    ) {
        type =
            "VMware";
    } else if (
        combined.includes("virtualbox")
    ) {
        type =
            "VirtualBox";
    } else if (
        combined.includes("microsoft") &&
        combined.includes("virtual")
    ) {
        type =
            "Hyper-V";
    } else if (
        combined.includes("xen")
    ) {
        type =
            "Xen";
    }

    return {
        type,
        productName,
        systemVendor
    };
}

async function getInitSystem() {
    return readTextFile(
        "/proc/1/comm",
        "unknown"
    );
}

async function getSystemInfo() {
    const cpuInformation =
        os.cpus();

    const logicalProcessors =
        cpuInformation.length;

    const physicalCores =
        logicalProcessors;

    const cpuModel =
        cpuInformation[0]
            ?.model
            ?.trim() ||
        "Unknown processor";

    const totalMemory =
        os.totalmem();

    const freeMemory =
        os.freemem();

    const usedMemory =
        totalMemory -
        freeMemory;

    const memoryUsage =
        totalMemory > 0
            ? Number(
                (
                    usedMemory /
                    totalMemory *
                    100
                ).toFixed(1)
            )
            : 0;

    const [
        distribution,
        cpuUsage,
        cpuFrequency,
        cpuTemperature,
        diskInformation,
        networkSpeed,
        processCounts,
        virtualization,
        initSystem
    ] = await Promise.all([
        getDistributionInformation(),
        getCpuUsage(),
        getCpuFrequency(),
        getCpuTemperature(),
        getRootDisk(),
        getNetworkSpeed(),
        getProcessCounts(),
        getVirtualization(),
        getInitSystem()
    ]);

    const networkInformation =
        getPrimaryNetworkAddress();

    const uptimeSeconds =
        os.uptime();

    const architecture =
        os.arch();

    const kernel =
        os.release();

    const hostname =
        os.hostname();

    const temperatureDisplay =
        cpuTemperature === null
            ? "Unavailable"
            : `${cpuTemperature} °C`;

    const processor = {
        name:
            cpuModel,

        model:
            cpuModel,

        usage:
            cpuUsage,

        speed:
            cpuFrequency.ghz,

        frequency:
            cpuFrequency.display,

        frequencyMhz:
            cpuFrequency.mhz,

        frequencyGhz:
            cpuFrequency.ghz,

        temperature:
            cpuTemperature,

        temperatureDisplay:
            temperatureDisplay,

        physicalCores,

        logicalCores:
            logicalProcessors,

        logicalProcessors,

        cores:
            physicalCores,

        threads:
            logicalProcessors
    };

    const memory = {
        total:
            totalMemory,

        used:
            usedMemory,

        free:
            freeMemory,

        usage:
            memoryUsage
    };

    const disk = {
        device:
            diskInformation.device,

        mount:
            diskInformation.mount,

        total:
            diskInformation.total,

        used:
            diskInformation.used,

        free:
            diskInformation.free,

        usage:
            diskInformation.usage
    };

    const network = {
        download:
            networkSpeed.download,

        upload:
            networkSpeed.upload,

        downloadSpeed:
            networkSpeed.download,

        uploadSpeed:
            networkSpeed.upload,

        interface:
            networkInformation.interface,

        address:
            networkInformation.address,

        ipAddress:
            networkInformation.address,

        netmask:
            networkInformation.netmask,

        mac:
            networkInformation.mac,

        macAddress:
            networkInformation.mac,

        cidr:
            networkInformation.cidr
    };

    return {
        success: true,

        platform:
            "Linux",

        operatingSystem:
            distribution.displayName,

        os:
            distribution.displayName,

        osName:
            distribution.name,

        osVersion:
            distribution.version,

        osCodename:
            distribution.codename,

        prettyName:
            distribution.prettyName,

        distribution,

        kernel,

        kernelVersion:
            kernel,

        architecture,

        arch:
            architecture,

        hostname,

        host:
            hostname,

        processor,

        processorName:
            cpuModel,

        cpu: {
            usage:
                cpuUsage,

            model:
                cpuModel,

            speed:
                cpuFrequency.ghz,

            frequency:
                cpuFrequency.display,

            temperature:
                cpuTemperature,

            physicalCores:
                physicalCores,

            logicalCores:
                logicalProcessors
        },

        cpuModel,

        cpuUsage,

        processorUsage:
            cpuUsage,

        cpuFrequency:
            cpuFrequency.display,

        cpuFrequencyMhz:
            cpuFrequency.mhz,

        cpuFrequencyDisplay:
            cpuFrequency.display,

        cpuTemperature,

        cpuTemperatureDisplay:
            temperatureDisplay,

        physicalCores,

        logicalProcessors,

        cores:
            physicalCores,

        threads:
            logicalProcessors,

        memory,

        totalMemory,

        usedMemory,

        freeMemory,

        memoryUsage,

        ramTotal:
            totalMemory,

        ramUsed:
            usedMemory,

        ramFree:
            freeMemory,

        ramUsage:
            memoryUsage,

        disk,

        diskTotal:
            diskInformation.total,

        diskUsed:
            diskInformation.used,

        diskFree:
            diskInformation.free,

        diskUsage:
            diskInformation.usage,

        diskMount:
            diskInformation.mount,

        network,

        download:
            networkSpeed.download,

        upload:
            networkSpeed.upload,

        downloadSpeed:
            networkSpeed.download,

        uploadSpeed:
            networkSpeed.upload,

        totalProcesses:
            processCounts.total,

        runningProcesses:
            processCounts.running,

        processCount:
            processCounts.total,

        processes: {
            total:
                processCounts.total,

            running:
                processCounts.running
        },

        uptime:
            uptimeSeconds,

        uptimeSeconds,

        ipAddress:
            networkInformation.address,

        interface:
            networkInformation.interface,

        macAddress:
            networkInformation.mac,

        initSystem,

        virtualization,

        nodeVersion:
            process.version,

        currentUser:
            os.userInfo().username,

        homeDirectory:
            os.homedir(),

        timestamp:
            Date.now()
    };
}

module.exports = {
    getSystemInfo
};
