const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const UNSUPPORTED_MESSAGE =
    "This system does not use systemd. Service management is unavailable here. Use the Console and manage services with your init system manually.";

const SERVICE_NAME_PATTERN =
    /^[a-zA-Z0-9_.@:-]+\.service$/;

const SHOW_PROPERTIES = [
    "Id",
    "Description",
    "LoadState",
    "ActiveState",
    "SubState",
    "UnitFileState",
    "MainPID",
    "FragmentPath"
];

let systemdSupportCache = null;

function createSystemError(
    message,
    code = "SERVICE_ERROR"
) {
    const error = new Error(message);
    error.code = code;
    return error;
}

async function commandExists(command) {
    try {
        await execFileAsync(
            "sh",
            [
                "-c",
                `command -v ${command}`
            ],
            {
                timeout: 3000,
                encoding: "utf8"
            }
        );

        return true;
    } catch {
        return false;
    }
}

async function readPidOneName() {
    try {
        return String(
            await fs.promises.readFile(
                "/proc/1/comm",
                "utf8"
            )
        ).trim();
    } catch {
        return "";
    }
}

async function detectSystemd() {
    if (systemdSupportCache) {
        return systemdSupportCache;
    }

    const [
        hasSystemctl,
        pidOneName
    ] = await Promise.all([
        commandExists("systemctl"),
        readPidOneName()
    ]);

    const runtimeDirectoryExists =
        fs.existsSync(
            "/run/systemd/system"
        );

    const supported =
        hasSystemctl &&
        (
            pidOneName === "systemd" ||
            runtimeDirectoryExists
        );

    systemdSupportCache = {
        supported,
        init:
            pidOneName ||
            "unknown",
        hasSystemctl,
        runtimeDirectoryExists,
        message:
            supported
                ? null
                : UNSUPPORTED_MESSAGE
    };

    return systemdSupportCache;
}

async function requireSystemd() {
    const support =
        await detectSystemd();

    if (!support.supported) {
        throw createSystemError(
            support.message,
            "SYSTEMD_NOT_AVAILABLE"
        );
    }

    return support;
}

function normalizeServiceName(value) {
    let serviceName =
        String(value || "")
            .trim();

    if (
        serviceName &&
        !serviceName.endsWith(
            ".service"
        )
    ) {
        serviceName +=
            ".service";
    }

    if (
        !SERVICE_NAME_PATTERN.test(
            serviceName
        )
    ) {
        throw createSystemError(
            "Invalid systemd service name.",
            "INVALID_SERVICE_NAME"
        );
    }

    return serviceName;
}

function parseSystemctlShow(output) {
    const properties = {};

    for (
        const line of
        String(output || "")
            .split(/\r?\n/)
    ) {
        const separatorIndex =
            line.indexOf("=");

        if (separatorIndex < 1) {
            continue;
        }

        const key =
            line.slice(
                0,
                separatorIndex
            );

        const value =
            line.slice(
                separatorIndex + 1
            );

        properties[key] = value;
    }

    return properties;
}

function mapStatus(
    activeState,
    subState
) {
    if (activeState === "active") {
        return "Running";
    }

    if (activeState === "activating") {
        return "Starting";
    }

    if (activeState === "deactivating") {
        return "Stopping";
    }

    if (activeState === "failed") {
        return "Failed";
    }

    if (subState === "exited") {
        return "Stopped";
    }

    return "Stopped";
}

function mapStartType(
    unitFileState
) {
    const state =
        String(
            unitFileState || ""
        ).toLowerCase();

    if (
        state === "enabled" ||
        state === "enabled-runtime"
    ) {
        return "Automatic";
    }

    if (
        state === "masked" ||
        state === "masked-runtime"
    ) {
        return "Disabled";
    }

    return "Manual";
}

async function runSystemctl(
    argumentsList,
    options = {}
) {
    await requireSystemd();

    try {
        const result =
            await execFileAsync(
                "systemctl",
                argumentsList,
                {
                    encoding: "utf8",
                    timeout:
                        options.timeout ||
                        15000,
                    maxBuffer:
                        16 * 1024 * 1024
                }
            );

        return {
            stdout:
                String(
                    result.stdout || ""
                ),
            stderr:
                String(
                    result.stderr || ""
                )
        };
    } catch (error) {
        const stderr =
            String(
                error.stderr || ""
            ).trim();

        const stdout =
            String(
                error.stdout || ""
            ).trim();

        throw createSystemError(
            stderr ||
            stdout ||
            error.message ||
            "systemctl command failed.",
            "SYSTEMCTL_FAILED"
        );
    }
}

async function listServiceNames() {
    const {
        stdout
    } = await runSystemctl(
        [
            "list-unit-files",
            "--type=service",
            "--all",
            "--no-legend",
            "--no-pager",
            "--plain"
        ],
        {
            timeout: 20000
        }
    );

    const names = new Set();

    for (
        const line of
        stdout.split(/\r?\n/)
    ) {
        const trimmed =
            line.trim();

        if (!trimmed) {
            continue;
        }

        const serviceName =
            trimmed.split(/\s+/)[0];

        if (
            SERVICE_NAME_PATTERN.test(
                serviceName
            )
        ) {
            names.add(serviceName);
        }
    }

    return Array.from(names)
        .sort((first, second) =>
            first.localeCompare(second)
        );
}

async function readService(
    serviceName
) {
    const normalizedName =
        normalizeServiceName(
            serviceName
        );

    const propertyArguments = [];

    for (
        const property of
        SHOW_PROPERTIES
    ) {
        propertyArguments.push(
            "--property",
            property
        );
    }

    const {
        stdout
    } = await runSystemctl(
        [
            "show",
            normalizedName,
            "--no-pager",
            ...propertyArguments
        ]
    );

    const properties =
        parseSystemctlShow(
            stdout
        );

    const name =
        properties.Id ||
        normalizedName;

    const status =
        mapStatus(
            properties.ActiveState,
            properties.SubState
        );

    const processId =
        Number(
            properties.MainPID
        ) || 0;

    return {
        name,

        displayName:
            properties.Description ||
            name,

        description:
            properties.Description ||
            "",

        status,

        activeState:
            properties.ActiveState ||
            "inactive",

        subState:
            properties.SubState ||
            "dead",

        loadState:
            properties.LoadState ||
            "unknown",

        startType:
            mapStartType(
                properties.UnitFileState
            ),

        unitFileState:
            properties.UnitFileState ||
            "unknown",

        processId,
        pid: processId,

        path:
            properties.FragmentPath ||
            "",

        fragmentPath:
            properties.FragmentPath ||
            ""
    };
}

async function mapWithConcurrency(
    values,
    concurrency,
    mapper
) {
    const results =
        new Array(values.length);

    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index =
                nextIndex++;

            if (
                index >=
                values.length
            ) {
                return;
            }

            try {
                results[index] =
                    await mapper(
                        values[index],
                        index
                    );
            } catch {
                results[index] = null;
            }
        }
    }

    const workerCount =
        Math.min(
            Math.max(
                1,
                concurrency
            ),
            values.length
        );

    await Promise.all(
        Array.from(
            {
                length:
                    workerCount
            },
            () => worker()
        )
    );

    return results.filter(Boolean);
}

async function getServices() {
    await requireSystemd();

    const serviceNames =
        await listServiceNames();

    const services =
        await mapWithConcurrency(
            serviceNames,
            12,
            readService
        );

    services.sort(
        (first, second) => {
            const firstRunning =
                first.status ===
                "Running"
                    ? 0
                    : 1;

            const secondRunning =
                second.status ===
                "Running"
                    ? 0
                    : 1;

            return (
                firstRunning -
                    secondRunning ||
                first.displayName.localeCompare(
                    second.displayName
                )
            );
        }
    );

    return services;
}

async function startService(
    serviceName
) {
    const normalizedName =
        normalizeServiceName(
            serviceName
        );

    await runSystemctl(
        [
            "start",
            normalizedName
        ],
        {
            timeout: 30000
        }
    );
}

async function stopService(
    serviceName
) {
    const normalizedName =
        normalizeServiceName(
            serviceName
        );

    await runSystemctl(
        [
            "stop",
            normalizedName
        ],
        {
            timeout: 30000
        }
    );
}

async function restartService(
    serviceName
) {
    const normalizedName =
        normalizeServiceName(
            serviceName
        );

    await runSystemctl(
        [
            "restart",
            normalizedName
        ],
        {
            timeout: 30000
        }
    );
}

async function unmaskService(
    serviceName
) {
    try {
        await runSystemctl(
            [
                "unmask",
                serviceName
            ]
        );
    } catch {
    }
}

async function setStartType(
    serviceName,
    startType
) {
    const normalizedName =
        normalizeServiceName(
            serviceName
        );

    const normalizedStartType =
        String(
            startType || ""
        )
            .trim()
            .toLowerCase();

    if (
        normalizedStartType ===
        "automatic"
    ) {
        await unmaskService(
            normalizedName
        );

        await runSystemctl(
            [
                "enable",
                normalizedName
            ],
            {
                timeout: 30000
            }
        );

        return;
    }

    if (
        normalizedStartType ===
        "manual"
    ) {
        await unmaskService(
            normalizedName
        );

        await runSystemctl(
            [
                "disable",
                normalizedName
            ],
            {
                timeout: 30000
            }
        );

        return;
    }

    if (
        normalizedStartType ===
        "disabled"
    ) {
        try {
            await runSystemctl(
                [
                    "disable",
                    normalizedName
                ],
                {
                    timeout: 30000
                }
            );
        } catch {
        }

        await runSystemctl(
            [
                "mask",
                normalizedName
            ],
            {
                timeout: 30000
            }
        );

        return;
    }

    throw createSystemError(
        "Invalid startup type. Expected Automatic, Manual, or Disabled.",
        "INVALID_START_TYPE"
    );
}

async function getSupportStatus() {
    return detectSystemd();
}

module.exports = {
    getSupportStatus,
    getServices,
    startService,
    stopService,
    restartService,
    setStartType
};
