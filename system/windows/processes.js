const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const systemInformation = require("systeminformation");

const execFileAsync = promisify(execFile);

const iconCacheDirectory = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "process-icons"
);

const iconCache = new Map();
const pendingIcons = new Map();

fs.mkdirSync(iconCacheDirectory, {
    recursive: true
});

function normalizeProcessName(name) {
    const value = String(name || "").trim();

    if (!value) {
        return "Unknown";
    }

    return value;
}

function normalizeExecutablePath(executablePath) {
    const value = String(executablePath || "").trim();

    if (!value) {
        return null;
    }

    return value;
}

function getIconFileName(executablePath) {
    const hash = crypto
        .createHash("sha256")
        .update(executablePath.toLowerCase())
        .digest("hex");

    return `${hash}.png`;
}

function getIconFilePath(executablePath) {
    return path.join(
        iconCacheDirectory,
        getIconFileName(executablePath)
    );
}

function getIconUrl(executablePath) {
    return `/api/processes/icon/${encodeURIComponent(
        getIconFileName(executablePath)
    )}`;
}

function isAllowedIconFileName(fileName) {
    return /^[a-f0-9]{64}\.png$/i.test(fileName);
}

async function extractProcessIcon(executablePath) {
    if (!executablePath || !fs.existsSync(executablePath)) {
        return null;
    }

    if (iconCache.has(executablePath)) {
        return iconCache.get(executablePath);
    }

    if (pendingIcons.has(executablePath)) {
        return pendingIcons.get(executablePath);
    }

    const iconPromise = (async () => {
        const outputPath = getIconFilePath(executablePath);

        if (fs.existsSync(outputPath)) {
            const iconUrl = getIconUrl(executablePath);

            iconCache.set(executablePath, iconUrl);

            return iconUrl;
        }

        const script = [
            "Add-Type -AssemblyName System.Drawing",
            `$source = ${JSON.stringify(executablePath)}`,
            `$output = ${JSON.stringify(outputPath)}`,
            "$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($source)",
            "if ($null -eq $icon) { exit 2 }",
            "$bitmap = $icon.ToBitmap()",
            "$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)",
            "$bitmap.Dispose()",
            "$icon.Dispose()"
        ].join("; ");

        try {
            await execFileAsync(
                "powershell.exe",
                [
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    script
                ],
                {
                    windowsHide: true,
                    timeout: 10000,
                    maxBuffer: 1024 * 1024
                }
            );

            if (!fs.existsSync(outputPath)) {
                return null;
            }

            const iconUrl = getIconUrl(executablePath);

            iconCache.set(executablePath, iconUrl);

            return iconUrl;
        } catch {
            return null;
        } finally {
            pendingIcons.delete(executablePath);
        }
    })();

    pendingIcons.set(executablePath, iconPromise);

    return iconPromise;
}

function convertMemoryToBytes(value) {
    const numericValue = Number(value) || 0;

    return Math.max(
        0,
        Math.round(numericValue * 1024)
    );
}

function normalizeCpuUsage(value) {
    return Number(
        Math.max(
            0,
            Number(value) || 0
        ).toFixed(1)
    );
}

async function getProcesses() {
    const result = await systemInformation.processes();

    const processes = Array.isArray(result.list)
        ? result.list
        : [];

    return processes
        .map((processInfo) => {
            const executablePath =
                normalizeExecutablePath(
                    processInfo.path
                );

            return {
                pid: Number(processInfo.pid) || 0,
                parentPid:
                    Number(processInfo.parentPid) || 0,
                name: normalizeProcessName(
                    processInfo.name
                ),
                command:
                    String(processInfo.command || ""),
                path: executablePath,
                user: String(processInfo.user || ""),
                state: String(processInfo.state || ""),
                cpu: normalizeCpuUsage(
                    processInfo.cpu
                ),
                memory: convertMemoryToBytes(
                    processInfo.memRss
                ),
                memoryPercent: Number(
                    Math.max(
                        0,
                        Number(processInfo.mem) || 0
                    ).toFixed(1)
                ),
                icon: executablePath
                    ? getIconUrl(executablePath)
                    : null
            };
        })
        .filter((processInfo) => processInfo.pid > 0)
        .sort((first, second) => {
            if (second.cpu !== first.cpu) {
                return second.cpu - first.cpu;
            }

            return second.memory - first.memory;
        });
}

function validatePid(pid) {
    const value = Number(pid);

    if (
        !Number.isInteger(value) ||
        value <= 0 ||
        value === process.pid
    ) {
        throw new Error("Invalid process identifier.");
    }

    return value;
}

async function endProcess(pid) {
    const processId = validatePid(pid);

    await execFileAsync(
        "taskkill.exe",
        [
            "/PID",
            String(processId),
            "/T",
            "/F"
        ],
        {
            windowsHide: true,
            timeout: 10000,
            maxBuffer: 1024 * 1024
        }
    );
}

async function suspendProcess(pid) {
    const processId = validatePid(pid);

    await execFileAsync(
        "powershell.exe",
        [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            `Suspend-Process -Id ${processId} -ErrorAction Stop`
        ],
        {
            windowsHide: true,
            timeout: 10000,
            maxBuffer: 1024 * 1024
        }
    );
}

async function resumeProcess(pid) {
    const processId = validatePid(pid);

    await execFileAsync(
        "powershell.exe",
        [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            `Resume-Process -Id ${processId} -ErrorAction Stop`
        ],
        {
            windowsHide: true,
            timeout: 10000,
            maxBuffer: 1024 * 1024
        }
    );
}

async function ensureIcon(executablePath) {
    return extractProcessIcon(
        normalizeExecutablePath(executablePath)
    );
}

function getIconPath(fileName) {
    if (!isAllowedIconFileName(fileName)) {
        return null;
    }

    const iconPath = path.join(
        iconCacheDirectory,
        fileName
    );

    if (!fs.existsSync(iconPath)) {
        return null;
    }

    return iconPath;
}

module.exports = {
    getProcesses,
    endProcess,
    suspendProcess,
    resumeProcess,
    ensureIcon,
    getIconPath
};