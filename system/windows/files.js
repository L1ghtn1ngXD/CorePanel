const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024;

function normalizePath(inputPath) {
    const value = String(inputPath || "").trim();

    if (!value || value.includes("\0")) {
        throw new Error("Invalid path.");
    }

    if (!path.win32.isAbsolute(value)) {
        throw new Error("An absolute path is required.");
    }

    return path.win32.normalize(value);
}

function validateName(name) {
    const value = String(name || "").trim();

    if (
        !value ||
        value === "." ||
        value === ".." ||
        /[<>:"/\\|?*\x00-\x1F]/.test(value)
    ) {
        throw new Error("Invalid file name.");
    }

    return value;
}

function getEntryType(stats) {
    if (stats.isDirectory()) {
        return "directory";
    }

    if (stats.isFile()) {
        return "file";
    }

    if (stats.isSymbolicLink()) {
        return "link";
    }

    return "other";
}

async function getDrives() {
    const script = [
        "Get-CimInstance Win32_LogicalDisk",
        "Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace, DriveType",
        "ConvertTo-Json -Depth 3 -Compress"
    ].join(" | ");

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
            timeout: 15000,
            maxBuffer: 4 * 1024 * 1024
        }
    );

    if (!stdout.trim()) {
        return [];
    }

    const parsed = JSON.parse(stdout);

    const drives = Array.isArray(parsed)
        ? parsed
        : [parsed];

    return drives
        .filter((drive) => drive.DeviceID)
        .map((drive) => ({
            path: `${drive.DeviceID}\\`,
            name: drive.DeviceID,
            label: String(drive.VolumeName || ""),
            fileSystem: String(drive.FileSystem || ""),
            total: Number(drive.Size) || 0,
            free: Number(drive.FreeSpace) || 0,
            driveType: Number(drive.DriveType) || 0
        }));
}

async function listDirectory(directoryPath) {
    const targetPath = normalizePath(directoryPath);

    const targetStats =
        await fsPromises.stat(targetPath);

    if (!targetStats.isDirectory()) {
        throw new Error(
            "The selected path is not a directory."
        );
    }

    const entries =
        await fsPromises.readdir(
            targetPath,
            {
                withFileTypes: true
            }
        );

    const result = await Promise.all(
        entries.map(async (entry) => {
            const entryPath =
                path.win32.join(
                    targetPath,
                    entry.name
                );

            try {
                const stats =
                    await fsPromises.lstat(
                        entryPath
                    );

                return {
                    name: entry.name,
                    path: entryPath,
                    type: getEntryType(stats),
                    size: stats.isFile()
                        ? Number(stats.size) || 0
                        : null,
                    createdAt: stats.birthtimeMs,
                    modifiedAt: stats.mtimeMs,
                    hidden: entry.name.startsWith("."),
                    inaccessible: false
                };
            } catch {
                return {
                    name: entry.name,
                    path: entryPath,
                    type: entry.isDirectory()
                        ? "directory"
                        : "other",
                    size: null,
                    createdAt: null,
                    modifiedAt: null,
                    hidden: entry.name.startsWith("."),
                    inaccessible: true
                };
            }
        })
    );

    result.sort((first, second) => {
        if (
            first.type === "directory" &&
            second.type !== "directory"
        ) {
            return -1;
        }

        if (
            first.type !== "directory" &&
            second.type === "directory"
        ) {
            return 1;
        }

        return first.name.localeCompare(
            second.name,
            undefined,
            {
                numeric: true,
                sensitivity: "base"
            }
        );
    });

    const parentPath =
        path.win32.dirname(targetPath);

    return {
        path: targetPath,
        parent:
            parentPath !== targetPath
                ? parentPath
                : null,
        entries: result
    };
}

async function getEntryInformation(entryPath) {
    const targetPath =
        normalizePath(entryPath);

    const stats =
        await fsPromises.lstat(targetPath);

    return {
        name:
            path.win32.basename(targetPath) ||
            targetPath,
        path: targetPath,
        parent: path.win32.dirname(targetPath),
        type: getEntryType(stats),
        size: Number(stats.size) || 0,
        createdAt: stats.birthtimeMs,
        modifiedAt: stats.mtimeMs,
        accessedAt: stats.atimeMs,
        readOnly: !(stats.mode & 0o200)
    };
}

async function createDirectory(
    parentPath,
    directoryName
) {
    const targetParent =
        normalizePath(parentPath);

    const name =
        validateName(directoryName);

    const newDirectoryPath =
        path.win32.join(
            targetParent,
            name
        );

    await fsPromises.mkdir(
        newDirectoryPath
    );

    return {
        path: newDirectoryPath
    };
}

async function createTextFile(
    parentPath,
    fileName,
    content = ""
) {
    const targetParent =
        normalizePath(parentPath);

    const name =
        validateName(fileName);

    const newFilePath =
        path.win32.join(
            targetParent,
            name
        );

    await fsPromises.writeFile(
        newFilePath,
        String(content),
        {
            encoding: "utf8",
            flag: "wx"
        }
    );

    return {
        path: newFilePath
    };
}

async function renameEntry(
    entryPath,
    newName
) {
    const targetPath =
        normalizePath(entryPath);

    const name =
        validateName(newName);

    const destinationPath =
        path.win32.join(
            path.win32.dirname(targetPath),
            name
        );

    await fsPromises.rename(
        targetPath,
        destinationPath
    );

    return {
        path: destinationPath
    };
}

async function deleteEntry(entryPath) {
    const targetPath =
        normalizePath(entryPath);

    const rootPath =
        path.win32.parse(targetPath).root;

    if (
        targetPath.toLowerCase() ===
        rootPath.toLowerCase()
    ) {
        throw new Error(
            "A drive root cannot be deleted."
        );
    }

    const stats =
        await fsPromises.lstat(targetPath);

    if (stats.isDirectory()) {
        await fsPromises.rm(
            targetPath,
            {
                recursive: true,
                force: false
            }
        );

        return;
    }

    await fsPromises.unlink(targetPath);
}

async function readTextFile(filePath) {
    const targetPath =
        normalizePath(filePath);

    const stats =
        await fsPromises.stat(targetPath);

    if (!stats.isFile()) {
        throw new Error(
            "The selected path is not a file."
        );
    }

    if (stats.size > MAX_TEXT_FILE_SIZE) {
        throw new Error(
            "The file is too large for the text editor."
        );
    }

    const buffer =
        await fsPromises.readFile(
            targetPath
        );

    if (buffer.includes(0)) {
        throw new Error(
            "The selected file is not a text file."
        );
    }

    return {
        path: targetPath,
        content: buffer.toString("utf8"),
        size: Number(stats.size) || 0,
        modifiedAt: stats.mtimeMs
    };
}

async function writeTextFile(
    filePath,
    content
) {
    const targetPath =
        normalizePath(filePath);

    const text =
        String(content ?? "");

    if (
        Buffer.byteLength(
            text,
            "utf8"
        ) > MAX_TEXT_FILE_SIZE
    ) {
        throw new Error(
            "The text is too large."
        );
    }

    await fsPromises.writeFile(
        targetPath,
        text,
        "utf8"
    );
}

function getDownloadPath(filePath) {
    const targetPath =
        normalizePath(filePath);

    if (!fs.existsSync(targetPath)) {
        throw new Error("File not found.");
    }

    const stats =
        fs.statSync(targetPath);

    if (!stats.isFile()) {
        throw new Error(
            "Only files can be downloaded."
        );
    }

    return targetPath;
}

module.exports = {
    getDrives,
    listDirectory,
    getEntryInformation,
    createDirectory,
    createTextFile,
    renameEntry,
    deleteEntry,
    readTextFile,
    writeTextFile,
    getDownloadPath,
    normalizePath
};