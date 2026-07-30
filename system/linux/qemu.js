const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync =
    promisify(execFile);

const VIRSH_URI =
    process.env.COREPANEL_LIBVIRT_URI ||
    "qemu:///system";

const DOMAIN_NAME_PATTERN =
    /^[a-zA-Z0-9_.:+-]{1,128}$/;

function createQemuError(
    message,
    code = "QEMU_ERROR"
) {
    const error =
        new Error(message);

    error.code =
        code;

    return error;
}

function normalizeDomainName(value) {
    const name =
        String(value || "")
            .trim();

    if (
        !DOMAIN_NAME_PATTERN.test(name)
    ) {
        throw createQemuError(
            "Invalid virtual machine name.",
            "INVALID_DOMAIN_NAME"
        );
    }

    return name;
}

async function runVirsh(
    argumentsList,
    options = {}
) {
    try {
        const result =
            await execFileAsync(
                "virsh",
                [
                    "--connect",
                    VIRSH_URI,
                    ...argumentsList
                ],
                {
                    encoding: "utf8",
                    timeout:
                        options.timeout ||
                        20000,
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
        if (
            error.code === "ENOENT"
        ) {
            throw createQemuError(
                "virsh is not installed. Install libvirt-clients first.",
                "VIRSH_NOT_INSTALLED"
            );
        }

        const stderr =
            String(
                error.stderr || ""
            ).trim();

        const stdout =
            String(
                error.stdout || ""
            ).trim();

        throw createQemuError(
            stderr ||
            stdout ||
            error.message ||
            "The virsh command failed.",
            "VIRSH_FAILED"
        );
    }
}

async function getSupportStatus() {
    try {
        const {
            stdout
        } = await runVirsh(
            [
                "uri"
            ],
            {
                timeout: 5000
            }
        );

        return {
            supported: true,
            uri:
                stdout.trim() ||
                VIRSH_URI,
            message: null
        };
    } catch (error) {
        return {
            supported: false,
            uri:
                VIRSH_URI,
            message:
                error.message
        };
    }
}

function parseDomInfo(output) {
    const result = {};

    for (
        const rawLine of
        String(output || "")
            .split(/\r?\n/)
    ) {
        const separatorIndex =
            rawLine.indexOf(":");

        if (
            separatorIndex < 1
        ) {
            continue;
        }

        const key =
            rawLine
                .slice(
                    0,
                    separatorIndex
                )
                .trim()
                .toLowerCase();

        const value =
            rawLine
                .slice(
                    separatorIndex + 1
                )
                .trim();

        result[key] =
            value;
    }

    return result;
}

function parseMemoryToBytes(value) {
    const match =
        String(value || "")
            .trim()
            .match(
                /^([\d.]+)\s*([a-zA-Z]+)?$/
            );

    if (!match) {
        return 0;
    }

    const amount =
        Number(match[1]) || 0;

    const unit =
        String(
            match[2] || "KiB"
        ).toLowerCase();

    const multipliers = {
        b: 1,
        kib: 1024,
        kb: 1000,
        mib: 1024 ** 2,
        mb: 1000 ** 2,
        gib: 1024 ** 3,
        gb: 1000 ** 3,
        tib: 1024 ** 4,
        tb: 1000 ** 4
    };

    return Math.round(
        amount *
        (
            multipliers[unit] ||
            1
        )
    );
}

function normalizeState(value) {
    const state =
        String(value || "")
            .trim()
            .toLowerCase();

    if (
        state === "running"
    ) {
        return "Running";
    }

    if (
        state === "paused"
    ) {
        return "Paused";
    }

    if (
        state === "shut off"
    ) {
        return "Shut Off";
    }

    if (
        state === "in shutdown"
    ) {
        return "Shutting Down";
    }

    if (
        state === "pmsuspended"
    ) {
        return "Suspended";
    }

    if (!state) {
        return "Unknown";
    }

    return state
        .replace(
            /\b\w/g,
            (character) =>
                character.toUpperCase()
        );
}

async function getDomainNames() {
    const {
        stdout
    } = await runVirsh(
        [
            "list",
            "--all",
            "--name"
        ]
    );

    return stdout
        .split(/\r?\n/)
        .map(
            (name) =>
                name.trim()
        )
        .filter(Boolean);
}

async function getAutostart(
    name
) {
    try {
        const {
            stdout
        } = await runVirsh(
            [
                "dominfo",
                name
            ]
        );

        const information =
            parseDomInfo(stdout);

        return (
            String(
                information.autostart ||
                ""
            ).toLowerCase() ===
            "enable"
        );
    } catch {
        return false;
    }
}

async function getDomain(
    domainName
) {
    const name =
        normalizeDomainName(
            domainName
        );

    const {
        stdout
    } = await runVirsh(
        [
            "dominfo",
            name
        ]
    );

    const information =
        parseDomInfo(stdout);

    const state =
        normalizeState(
            information.state
        );

    const vcpus =
        Number(
            information["cpu(s)"]
        ) || 0;

    const memoryBytes =
        parseMemoryToBytes(
            information["max memory"] ||
            information["used memory"]
        );

    const autostart =
        String(
            information.autostart ||
            ""
        ).toLowerCase() ===
        "enable";

    return {
        id:
            information.id &&
            information.id !== "-"
                ? Number(
                    information.id
                ) || null
                : null,

        name:
            information.name ||
            name,

        uuid:
            information.uuid ||
            "",

        state,

        running:
            state === "Running",

        paused:
            state === "Paused",

        vcpus,

        memoryBytes,

        memoryMiB:
            Math.round(
                memoryBytes /
                1024 /
                1024
            ),

        autostart,

        persistent:
            String(
                information.persistent ||
                ""
            ).toLowerCase() ===
            "yes"
    };
}

async function getVirtualMachines() {
    const support =
        await getSupportStatus();

    if (!support.supported) {
        throw createQemuError(
            support.message ||
            "QEMU/libvirt is not available.",
            "QEMU_NOT_SUPPORTED"
        );
    }

    const names =
        await getDomainNames();

    const machines =
        (
            await Promise.all(
                names.map(
                    async (name) => {
                        try {
                            return await getDomain(
                                name
                            );
                        } catch {
                            return null;
                        }
                    }
                )
            )
        )
            .filter(Boolean);

    machines.sort(
        (first, second) => {
            const firstRank =
                first.running
                    ? 0
                    : first.paused
                        ? 1
                        : 2;

            const secondRank =
                second.running
                    ? 0
                    : second.paused
                        ? 1
                        : 2;

            return (
                firstRank -
                    secondRank ||
                first.name.localeCompare(
                    second.name
                )
            );
        }
    );

    return machines;
}

async function runDomainAction(
    domainName,
    action
) {
    const name =
        normalizeDomainName(
            domainName
        );

    const actionArguments = {
        start:
            [
                "start",
                name
            ],

        shutdown:
            [
                "shutdown",
                name
            ],

        destroy:
            [
                "destroy",
                name
            ],

        reboot:
            [
                "reboot",
                name
            ],

        reset:
            [
                "reset",
                name
            ],

        suspend:
            [
                "suspend",
                name
            ],

        resume:
            [
                "resume",
                name
            ]
    };

    const argumentsList =
        actionArguments[action];

    if (!argumentsList) {
        throw createQemuError(
            "Unsupported virtual machine action.",
            "INVALID_QEMU_ACTION"
        );
    }

    await runVirsh(
        argumentsList,
        {
            timeout: 30000
        }
    );
}

async function setAutostart(
    domainName,
    enabled
) {
    const name =
        normalizeDomainName(
            domainName
        );

    await runVirsh(
        enabled
            ? [
                "autostart",
                name
            ]
            : [
                "autostart",
                name,
                "--disable"
            ],
        {
            timeout: 30000
        }
    );
}

module.exports = {
    getSupportStatus,
    getVirtualMachines,
    getDomain,
    runDomainAction,
    setAutostart
};
