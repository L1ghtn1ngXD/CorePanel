const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync =
    promisify(execFile);

const MAX_DIRECTORY_ENTRIES =
    10000;

const VIRTUAL_FILE_SYSTEMS =
    new Set([
        "autofs",
        "bpf",
        "cgroup",
        "cgroup2",
        "configfs",
        "debugfs",
        "devpts",
        "devtmpfs",
        "efivarfs",
        "fusectl",
        "hugetlbfs",
        "mqueue",
        "nsfs",
        "overlay",
        "proc",
        "pstore",
        "ramfs",
        "securityfs",
        "sysfs",
        "tmpfs",
        "tracefs"
    ]);

function normalizeAbsolutePath(value) {
    const normalized =
        path.resolve(
            String(value || "")
        );

    if (!path.isAbsolute(normalized)) {
        throw new Error(
            "An absolute path is required."
        );
    }

    return normalized;
}

function getParentPath(
    directoryPath
) {
    if (directoryPath === "/") {
        return null;
    }

    const parentPath =
        path.dirname(
            directoryPath
        );

    return (
        parentPath === directoryPath
            ? null
            : parentPath
    );
}

function getEntryType(
    directoryEntry,
    stats
) {
    if (
        directoryEntry.isDirectory() ||
        stats?.isDirectory()
    ) {
        return "directory";
    }

    if (
        directoryEntry.isSymbolicLink()
    ) {
        return "symlink";
    }

    if (
        directoryEntry.isFile() ||
        stats?.isFile()
    ) {
        return "file";
    }

    return "other";
}

function formatMountName(
    mountPoint
) {
    if (mountPoint === "/") {
        return "Root File System";
    }

    return (
        path.basename(
            mountPoint
        ) ||
        mountPoint
    );
}

async function getFileSystemInformation(
    mountPoint
) {
    const {
        stdout
    } = await execFileAsync(
        "df",
        [
            "-B1",
            "-P",
            mountPoint
        ],
        {
            encoding: "utf8",
            timeout: 5000,
            maxBuffer:
                4 * 1024 * 1024
        }
    );

    const lines =
        String(stdout)
            .trim()
            .split(/\r?\n/);

    const dataLine =
        lines[lines.length - 1]
            .trim();

    const fields =
        dataLine.split(/\s+/);

    if (fields.length < 6) {
        throw new Error(
            "Failed to parse filesystem information."
        );
    }

    return {
        total:
            Number(fields[1]) || 0,

        used:
            Number(fields[2]) || 0,

        free:
            Number(fields[3]) || 0
    };
}

async function readMounts() {
    const content =
        await fs.promises.readFile(
            "/proc/self/mounts",
            "utf8"
        );

    const mounts =
        new Map();

    for (
        const line of
        content.split(/\r?\n/)
    ) {
        if (!line.trim()) {
            continue;
        }

        const fields =
            line.split(" ");

        if (fields.length < 3) {
            continue;
        }

        const device =
            fields[0]
                .replace(/\\040/g, " ");

        const mountPoint =
            fields[1]
                .replace(/\\040/g, " ");

        const fileSystem =
            fields[2];

        if (
            VIRTUAL_FILE_SYSTEMS.has(
                fileSystem
            )
        ) {
            continue;
        }

        if (
            !path.isAbsolute(
                mountPoint
            )
        ) {
            continue;
        }

        if (
            mounts.has(
                mountPoint
            )
        ) {
            continue;
        }

        mounts.set(
            mountPoint,
            {
                device,
                mountPoint,
                fileSystem
            }
        );
    }

    if (!mounts.has("/")) {
        mounts.set(
            "/",
            {
                device: "rootfs",
                mountPoint: "/",
                fileSystem: "unknown"
            }
        );
    }

    return Array.from(
        mounts.values()
    ).sort(
        (first, second) => {
            if (
                first.mountPoint === "/"
            ) {
                return -1;
            }

            if (
                second.mountPoint === "/"
            ) {
                return 1;
            }

            return first.mountPoint
                .localeCompare(
                    second.mountPoint
                );
        }
    );
}

async function getDrives() {
    const mounts =
        await readMounts();

    const drives = [];

    for (
        const mount of
        mounts
    ) {
        try {
            const information =
                await getFileSystemInformation(
                    mount.mountPoint
                );

            drives.push({
                path:
                    mount.mountPoint,

                name:
                    formatMountName(
                        mount.mountPoint
                    ),

                label:
                    mount.device,

                fileSystem:
                    mount.fileSystem,

                total:
                    information.total,

                used:
                    information.used,

                free:
                    information.free,

                driveType:
                    mount.mountPoint === "/"
                        ? 3
                        : 4,

                removable:
                    mount.mountPoint
                        .startsWith(
                            "/media/"
                        ) ||
                    mount.mountPoint
                        .startsWith(
                            "/mnt/"
                        )
            });
        } catch {
        }
    }

    return drives;
}

async function readEntry(
    directoryPath,
    directoryEntry
) {
    const entryPath =
        path.join(
            directoryPath,
            directoryEntry.name
        );

    let stats = null;
    let linkTarget = null;

    try {
        stats =
            await fs.promises.lstat(
                entryPath
            );
    } catch {
    }

    if (
        directoryEntry.isSymbolicLink()
    ) {
        try {
            linkTarget =
                await fs.promises.readlink(
                    entryPath
                );
        } catch {
        }
    }

    const type =
        getEntryType(
            directoryEntry,
            stats
        );

    return {
        name:
            directoryEntry.name,

        path:
            entryPath,

        type,

        isDirectory:
            type === "directory",

        isFile:
            type === "file",

        isSymbolicLink:
            type === "symlink",

        extension:
            type === "file"
                ? path.extname(
                    directoryEntry.name
                ).toLowerCase()
                : "",

        size:
            stats?.size || 0,

        createdAt:
            stats?.birthtime
                ?.toISOString?.() ||
            null,

        modifiedAt:
            stats?.mtime
                ?.toISOString?.() ||
            null,

        accessedAt:
            stats?.atime
                ?.toISOString?.() ||
            null,

        mode:
            stats
                ? (
                    stats.mode &
                    0o7777
                )
                    .toString(8)
                    .padStart(
                        4,
                        "0"
                    )
                : null,

        ownerId:
            stats?.uid ?? null,

        groupId:
            stats?.gid ?? null,

        linkTarget
    };
}

async function listDirectory(
    requestedPath
) {
    const directoryPath =
        normalizeAbsolutePath(
            requestedPath
        );

    const directoryStats =
        await fs.promises.stat(
            directoryPath
        );

    if (
        !directoryStats.isDirectory()
    ) {
        const error =
            new Error(
                "The requested path is not a directory."
            );

        error.code =
            "ENOTDIR";

        throw error;
    }

    const directoryEntries =
        await fs.promises.readdir(
            directoryPath,
            {
                withFileTypes: true
            }
        );

    if (
        directoryEntries.length >
        MAX_DIRECTORY_ENTRIES
    ) {
        const error =
            new Error(
                `This directory contains more than ${MAX_DIRECTORY_ENTRIES} entries.`
            );

        error.code =
            "E2BIG";

        throw error;
    }

    const entries =
        await Promise.all(
            directoryEntries.map(
                (entry) =>
                    readEntry(
                        directoryPath,
                        entry
                    )
            )
        );

    entries.sort(
        (first, second) => {
            if (
                first.isDirectory &&
                !second.isDirectory
            ) {
                return -1;
            }

            if (
                !first.isDirectory &&
                second.isDirectory
            ) {
                return 1;
            }

            return first.name.localeCompare(
                second.name,
                undefined,
                {
                    numeric: true,
                    sensitivity:
                        "base"
                }
            );
        }
    );

    return {
        path:
            directoryPath,

        currentPath:
            directoryPath,

        name:
            directoryPath === "/"
                ? "/"
                : path.basename(
                    directoryPath
                ),

        parentPath:
            getParentPath(
                directoryPath
            ),

        rootPath:
            "/",

        separator:
            path.sep,

        homePath:
            os.homedir(),

        count:
            entries.length,

        entries
    };
}

module.exports = {
    getDrives,
    listDirectory
};
