const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function normalizeStatus(value) {
    const status = String(value || "").trim().toLowerCase();

    if (status === "running") {
        return "Running";
    }

    if (status === "paused") {
        return "Paused";
    }

    if (status === "start pending") {
        return "Start Pending";
    }

    if (status === "stop pending") {
        return "Stop Pending";
    }

    if (status === "continue pending") {
        return "Continue Pending";
    }

    if (status === "pause pending") {
        return "Pause Pending";
    }

    return "Stopped";
}

function normalizeStartType(value) {
    const startType = String(value || "")
        .trim()
        .toLowerCase();

    if (
        startType === "auto" ||
        startType === "automatic"
    ) {
        return "Automatic";
    }

    if (
        startType.includes("delayed") ||
        startType.includes("delay")
    ) {
        return "Automatic Delayed";
    }

    if (
        startType === "manual" ||
        startType === "demand"
    ) {
        return "Manual";
    }

    if (
        startType === "disabled" ||
        startType === "disable"
    ) {
        return "Disabled";
    }

    if (
        startType === "boot" ||
        startType === "system"
    ) {
        return "System";
    }

    return "Unknown";
}

async function runPowerShell(script) {
    const { stdout } = await execFileAsync(
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
            timeout: 30000,
            maxBuffer: 32 * 1024 * 1024
        }
    );

    return stdout;
}

async function getServices() {
    const script = [
        "$services = Get-CimInstance Win32_Service | Select-Object Name, DisplayName, State, StartMode, ProcessId, PathName",
        "$services | ConvertTo-Json -Depth 4 -Compress"
    ].join("; ");

    const output = await runPowerShell(script);

    if (!output.trim()) {
        return [];
    }

    const parsed = JSON.parse(output);
    const services = Array.isArray(parsed)
        ? parsed
        : [parsed];

    return services
        .map((service) => ({
            name: String(service.Name || ""),
            displayName: String(
                service.DisplayName || service.Name || ""
            ),
            status: normalizeStatus(service.State),
            startType: normalizeStartType(
                service.StartMode
            ),
            processId: Number(service.ProcessId) || 0,
            path: String(service.PathName || "")
        }))
        .filter((service) => service.name)
        .sort((first, second) =>
            first.displayName.localeCompare(
                second.displayName
            )
        );
}

function validateServiceName(serviceName) {
    const value = String(serviceName || "").trim();

    if (!/^[a-zA-Z0-9_.-]{1,256}$/.test(value)) {
        throw new Error("Invalid service name.");
    }

    return value;
}

async function runSc(argumentsList) {
    return execFileAsync(
        "sc.exe",
        argumentsList,
        {
            windowsHide: true,
            timeout: 30000,
            maxBuffer: 4 * 1024 * 1024
        }
    );
}

async function startService(serviceName) {
    const name = validateServiceName(serviceName);

    await runSc([
        "start",
        name
    ]);
}

async function stopService(serviceName) {
    const name = validateServiceName(serviceName);

    await runSc([
        "stop",
        name
    ]);
}

async function waitForServiceStatus(
    serviceName,
    expectedStatus,
    timeout = 15000
) {
    const name = validateServiceName(serviceName);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeout) {
        const script = [
            `$service = Get-CimInstance Win32_Service -Filter "Name='${name}'"`,
            "if ($null -eq $service) { exit 2 }",
            "$service.State"
        ].join("; ");

        const output = await runPowerShell(script);

        if (
            String(output)
                .trim()
                .toLowerCase() ===
            expectedStatus.toLowerCase()
        ) {
            return;
        }

        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });
    }

    throw new Error(
        `Service did not reach the ${expectedStatus} state.`
    );
}

async function restartService(serviceName) {
    const name = validateServiceName(serviceName);

    try {
        await stopService(name);
        await waitForServiceStatus(name, "Stopped");
    } catch (error) {
        const message = String(
            error?.stderr ||
            error?.stdout ||
            error?.message ||
            ""
        );

        if (
            !message
                .toLowerCase()
                .includes("not been started")
        ) {
            throw error;
        }
    }

    await startService(name);
}

async function setStartType(serviceName, startType) {
    const name = validateServiceName(serviceName);
    const normalizedType = String(
        startType || ""
    ).trim();

    const startTypeMap = {
        Automatic: "auto",
        "Automatic Delayed": "delayed-auto",
        Manual: "demand",
        Disabled: "disabled"
    };

    const value = startTypeMap[normalizedType];

    if (!value) {
        throw new Error("Invalid startup type.");
    }

    await runSc([
        "config",
        name,
        "start=",
        value
    ]);
}

module.exports = {
    getServices,
    startService,
    stopService,
    restartService,
    setStartType
};