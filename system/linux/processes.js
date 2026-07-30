const fs = require("fs");
const fsPromises = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync =
    promisify(execFile);

const PROC_DIRECTORY =
    "/proc";

const CLOCK_TICKS =
    100;

const PAGE_SIZE =
    4096;

const ICON_CACHE_DIRECTORY =
    path.join(
        __dirname,
        "..",
        "..",
        "data",
        "process-icons-linux"
    );

const DESKTOP_FILE_DIRECTORIES = [
    "/usr/share/applications",
    "/usr/local/share/applications",
    path.join(
        os.homedir(),
        ".local",
        "share",
        "applications"
    )
];

const ICON_DIRECTORIES = [
    "/usr/share/icons/hicolor",
    "/usr/share/icons/Adwaita",
    "/usr/share/icons",
    "/usr/local/share/icons",
    "/usr/share/pixmaps",
    path.join(
        os.homedir(),
        ".local",
        "share",
        "icons"
    )
];

const ICON_EXTENSIONS = [
    ".png",
    ".svg",
    ".xpm",
    ".jpg",
    ".jpeg",
    ".webp"
];

const desktopEntryCache =
    new Map();

const resolvedIconCache =
    new Map();

let desktopEntriesLoaded =
    false;

function clampNumber(
    value,
    minimum,
    maximum,
    fallback = 0
) {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.max(
        minimum,
        Math.min(
            maximum,
            number
        )
    );
}

function isValidProcessId(value) {
    const processId =
        Number(value);

    return (
        Number.isInteger(processId) &&
        processId > 0 &&
        processId <= 4194304
    );
}

function normalizeProcessId(value) {
    if (!isValidProcessId(value)) {
        throw new Error(
            "Invalid process identifier."
        );
    }

    return Number(value);
}

function getSystemUptimeTicks() {
    const uptimeSeconds =
        os.uptime();

    return (
        uptimeSeconds *
        CLOCK_TICKS
    );
}

function getBootTimeMilliseconds() {
    return (
        Date.now() -
        os.uptime() * 1000
    );
}

function decodeNullSeparatedText(buffer) {
    return buffer
        .toString("utf8")
        .split("\0")
        .filter(Boolean)
        .join(" ")
        .trim();
}

function sanitizeFileName(value) {
    return String(value)
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        )
        .slice(
            0,
            180
        );
}

function parseDesktopFile(content) {
    const entry = {};

    let insideDesktopEntry =
        false;

    const lines =
        String(content)
            .split(/\r?\n/);

    for (const rawLine of lines) {
        const line =
            rawLine.trim();

        if (!line) {
            continue;
        }

        if (
            line.startsWith("#")
        ) {
            continue;
        }

        if (
            line.startsWith("[") &&
            line.endsWith("]")
        ) {
            insideDesktopEntry =
                line ===
                "[Desktop Entry]";

            continue;
        }

        if (!insideDesktopEntry) {
            continue;
        }

        const separatorIndex =
            line.indexOf("=");

        if (separatorIndex <= 0) {
            continue;
        }

        const key =
            line
                .slice(
                    0,
                    separatorIndex
                )
                .trim();

        const value =
            line
                .slice(
                    separatorIndex + 1
                )
                .trim();

        if (
            key === "Name" ||
            key === "Exec" ||
            key === "Icon" ||
            key === "NoDisplay" ||
            key === "Hidden"
        ) {
            entry[key] =
                value;
        }
    }

    return entry;
}

function extractExecutableName(
    command
) {
    let value =
        String(command || "")
            .trim();

    if (!value) {
        return "";
    }

    value = value.replace(
        /%[fFuUdDnNickvm]/g,
        ""
    );

    const quotedMatch =
        value.match(
            /^"([^"]+)"/
        );

    if (quotedMatch) {
        value =
            quotedMatch[1];
    } else {
        value =
            value.split(/\s+/)[0];
    }

    return path
        .basename(value)
        .toLowerCase();
}

async function walkDesktopFiles(
    directory,
    result
) {
    let entries;

    try {
        entries =
            await fsPromises.readdir(
                directory,
                {
                    withFileTypes: true
                }
            );
    } catch {
        return;
    }

    for (const entry of entries) {
        const fullPath =
            path.join(
                directory,
                entry.name
            );

        if (
            entry.isDirectory()
        ) {
            await walkDesktopFiles(
                fullPath,
                result
            );

            continue;
        }

        if (
            entry.isFile() &&
            entry.name
                .toLowerCase()
                .endsWith(".desktop")
        ) {
            result.push(
                fullPath
            );
        }
    }
}

async function loadDesktopEntries() {
    if (desktopEntriesLoaded) {
        return;
    }

    desktopEntriesLoaded =
        true;

    const desktopFiles = [];

    for (
        const directory of
        DESKTOP_FILE_DIRECTORIES
    ) {
        await walkDesktopFiles(
            directory,
            desktopFiles
        );
    }

    for (
        const desktopFile of
        desktopFiles
    ) {
        try {
            const content =
                await fsPromises.readFile(
                    desktopFile,
                    "utf8"
                );

            const entry =
                parseDesktopFile(
                    content
                );

            if (
                entry.Hidden === "true" ||
                entry.NoDisplay === "true"
            ) {
                continue;
            }

            const executableName =
                extractExecutableName(
                    entry.Exec
                );

            if (
                !executableName ||
                !entry.Icon
            ) {
                continue;
            }

            if (
                !desktopEntryCache.has(
                    executableName
                )
            ) {
                desktopEntryCache.set(
                    executableName,
                    {
                        name:
                            entry.Name ||
                            executableName,

                        icon:
                            entry.Icon,

                        desktopFile
                    }
                );
            }
        } catch {
        }
    }
}

async function findFileRecursively(
    directory,
    wantedNames,
    maximumDepth = 7,
    currentDepth = 0
) {
    if (
        currentDepth >
        maximumDepth
    ) {
        return null;
    }

    let entries;

    try {
        entries =
            await fsPromises.readdir(
                directory,
                {
                    withFileTypes: true
                }
            );
    } catch {
        return null;
    }

    for (const entry of entries) {
        if (
            entry.isFile() &&
            wantedNames.has(
                entry.name.toLowerCase()
            )
        ) {
            return path.join(
                directory,
                entry.name
            );
        }
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const result =
            await findFileRecursively(
                path.join(
                    directory,
                    entry.name
                ),
                wantedNames,
                maximumDepth,
                currentDepth + 1
            );

        if (result) {
            return result;
        }
    }

    return null;
}

async function resolveIconPath(
    iconName
) {
    const normalizedIconName =
        String(iconName || "")
            .trim();

    if (!normalizedIconName) {
        return null;
    }

    if (
        resolvedIconCache.has(
            normalizedIconName
        )
    ) {
        return resolvedIconCache.get(
            normalizedIconName
        );
    }

    if (
        path.isAbsolute(
            normalizedIconName
        ) &&
        fs.existsSync(
            normalizedIconName
        )
    ) {
        resolvedIconCache.set(
            normalizedIconName,
            normalizedIconName
        );

        return normalizedIconName;
    }

    const iconBaseName =
        path.basename(
            normalizedIconName,
            path.extname(
                normalizedIconName
            )
        );

    const wantedNames =
        new Set();

    for (
        const extension of
        ICON_EXTENSIONS
    ) {
        wantedNames.add(
            (
                iconBaseName +
                extension
            ).toLowerCase()
        );
    }

    for (
        const directory of
        ICON_DIRECTORIES
    ) {
        const result =
            await findFileRecursively(
                directory,
                wantedNames
            );

        if (result) {
            resolvedIconCache.set(
                normalizedIconName,
                result
            );

            return result;
        }
    }

    resolvedIconCache.set(
        normalizedIconName,
        null
    );

    return null;
}

async function copyIconToCache(
    sourcePath,
    identity
) {
    await fsPromises.mkdir(
        ICON_CACHE_DIRECTORY,
        {
            recursive: true
        }
    );

    const extension =
        path.extname(
            sourcePath
        ).toLowerCase() ||
        ".png";

    const hash =
        crypto
            .createHash("sha256")
            .update(
                String(identity)
            )
            .digest("hex")
            .slice(
                0,
                32
            );

    const fileName =
        sanitizeFileName(
            `${hash}${extension}`
        );

    const destinationPath =
        path.join(
            ICON_CACHE_DIRECTORY,
            fileName
        );

    if (
        !fs.existsSync(
            destinationPath
        )
    ) {
        await fsPromises.copyFile(
            sourcePath,
            destinationPath
        );
    }

    return fileName;
}

async function getUserName(
    userId
) {
    try {
        const {
            stdout
        } = await execFileAsync(
            "getent",
            [
                "passwd",
                String(userId)
            ],
            {
                encoding: "utf8",
                timeout: 2000
            }
        );

        const firstLine =
            String(stdout)
                .split(/\r?\n/)[0];

        const name =
            firstLine
                .split(":")[0]
                .trim();

        return (
            name ||
            String(userId)
        );
    } catch {
        return String(userId);
    }
}

async function readProcessStat(
    processId
) {
    const statPath =
        path.join(
            PROC_DIRECTORY,
            String(processId),
            "stat"
        );

    const content =
        await fsPromises.readFile(
            statPath,
            "utf8"
        );

    const openingParenthesis =
        content.indexOf("(");

    const closingParenthesis =
        content.lastIndexOf(")");

    if (
        openingParenthesis < 0 ||
        closingParenthesis < 0
    ) {
        throw new Error(
            "Invalid process stat data."
        );
    }

    const processName =
        content.slice(
            openingParenthesis + 1,
            closingParenthesis
        );

    const fields =
        content
            .slice(
                closingParenthesis + 2
            )
            .trim()
            .split(/\s+/);

    const state =
        fields[0];

    const parentProcessId =
        Number(
            fields[1]
        ) || 0;

    const userTicks =
        Number(
            fields[11]
        ) || 0;

    const systemTicks =
        Number(
            fields[12]
        ) || 0;

    const childrenUserTicks =
        Number(
            fields[13]
        ) || 0;

    const childrenSystemTicks =
        Number(
            fields[14]
        ) || 0;

    const priority =
        Number(
            fields[15]
        ) || 0;

    const nice =
        Number(
            fields[16]
        ) || 0;

    const threadCount =
        Number(
            fields[17]
        ) || 0;

    const startTimeTicks =
        Number(
            fields[19]
        ) || 0;

    const virtualMemoryBytes =
        Number(
            fields[20]
        ) || 0;

    const residentPages =
        Number(
            fields[21]
        ) || 0;

    return {
        processName,
        state,
        parentProcessId,
        userTicks,
        systemTicks,
        childrenUserTicks,
        childrenSystemTicks,
        priority,
        nice,
        threadCount,
        startTimeTicks,
        virtualMemoryBytes,
        residentMemoryBytes:
            residentPages *
            PAGE_SIZE
    };
}

async function readProcessStatus(
    processId
) {
    const statusPath =
        path.join(
            PROC_DIRECTORY,
            String(processId),
            "status"
        );

    const content =
        await fsPromises.readFile(
            statusPath,
            "utf8"
        );

    const result = {};

    for (
        const line of
        content.split(/\r?\n/)
    ) {
        const separatorIndex =
            line.indexOf(":");

        if (separatorIndex <= 0) {
            continue;
        }

        const key =
            line
                .slice(
                    0,
                    separatorIndex
                )
                .trim();

        const value =
            line
                .slice(
                    separatorIndex + 1
                )
                .trim();

        result[key] =
            value;
    }

    const userId =
        Number(
            String(
                result.Uid || ""
            )
                .split(/\s+/)[0]
        ) || 0;

    return {
        userId,

        state:
            result.State || "",

        threadCount:
            Number(
                result.Threads
            ) || 0,

        residentMemoryBytes:
            (
                Number.parseInt(
                    result.VmRSS,
                    10
                ) || 0
            ) * 1024,

        virtualMemoryBytes:
            (
                Number.parseInt(
                    result.VmSize,
                    10
                ) || 0
            ) * 1024
    };
}

async function readProcessCommandLine(
    processId
) {
    try {
        const buffer =
            await fsPromises.readFile(
                path.join(
                    PROC_DIRECTORY,
                    String(processId),
                    "cmdline"
                )
            );

        return decodeNullSeparatedText(
            buffer
        );
    } catch {
        return "";
    }
}

async function readProcessExecutable(
    processId
) {
    try {
        return await fsPromises.readlink(
            path.join(
                PROC_DIRECTORY,
                String(processId),
                "exe"
            )
        );
    } catch {
        return "";
    }
}

function mapLinuxState(
    state
) {
    const stateCode =
        String(state || "")
            .charAt(0)
            .toUpperCase();

    const states = {
        R: "Running",
        S: "Sleeping",
        D: "Disk sleep",
        Z: "Zombie",
        T: "Stopped",
        t: "Tracing stop",
        X: "Dead",
        I: "Idle",
        P: "Parked"
    };

    return (
        states[stateCode] ||
        "Unknown"
    );
}

async function createProcessSnapshot(
    processId
) {
    const [
        stat,
        status,
        commandLine,
        executablePath
    ] = await Promise.all([
        readProcessStat(
            processId
        ),

        readProcessStatus(
            processId
        ).catch(() => ({
            userId: 0,
            state: "",
            threadCount: 0,
            residentMemoryBytes: 0,
            virtualMemoryBytes: 0
        })),

        readProcessCommandLine(
            processId
        ),

        readProcessExecutable(
            processId
        )
    ]);

    return {
        processId,
        stat,
        status,
        commandLine,
        executablePath,

        totalCpuTicks:
            stat.userTicks +
            stat.systemTicks,

        capturedAt:
            process.hrtime.bigint()
    };
}

async function getProcessIds() {
    const entries =
        await fsPromises.readdir(
            PROC_DIRECTORY,
            {
                withFileTypes: true
            }
        );

    return entries
        .filter(
            (entry) =>
                entry.isDirectory() &&
                /^\d+$/.test(
                    entry.name
                )
        )
        .map(
            (entry) =>
                Number(
                    entry.name
                )
        )
        .filter(
            isValidProcessId
        );
}

async function captureProcesses() {
    const processIds =
        await getProcessIds();

    const snapshots =
        new Map();

    await Promise.all(
        processIds.map(
            async (processId) => {
                try {
                    const snapshot =
                        await createProcessSnapshot(
                            processId
                        );

                    snapshots.set(
                        processId,
                        snapshot
                    );
                } catch {
                }
            }
        )
    );

    return snapshots;
}

function wait(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(
            resolve,
            milliseconds
        );
    });
}

function calculateCpuPercentage(
    firstSnapshot,
    secondSnapshot,
    elapsedNanoseconds
) {
    if (
        !firstSnapshot ||
        !secondSnapshot ||
        elapsedNanoseconds <= 0
    ) {
        return 0;
    }

    const processTickDifference =
        secondSnapshot.totalCpuTicks -
        firstSnapshot.totalCpuTicks;

    if (
        processTickDifference <= 0
    ) {
        return 0;
    }

    const elapsedSeconds =
        Number(
            elapsedNanoseconds
        ) /
        1_000_000_000;

    const processSeconds =
        processTickDifference /
        CLOCK_TICKS;

    const cpuPercentage =
        (
            processSeconds /
            elapsedSeconds
        ) * 100;

    return clampNumber(
        cpuPercentage,
        0,
        os.cpus().length * 100,
        0
    );
}

async function getProcesses() {
    const firstCapture =
        await captureProcesses();

    const firstTime =
        process.hrtime.bigint();

    await wait(180);

    const secondCapture =
        await captureProcesses();

    const secondTime =
        process.hrtime.bigint();

    const elapsedNanoseconds =
        secondTime -
        firstTime;

    const bootTimeMilliseconds =
        getBootTimeMilliseconds();

    const userNameCache =
        new Map();

    const processes = [];

    for (
        const [
            processId,
            snapshot
        ] of secondCapture
    ) {
        const firstSnapshot =
            firstCapture.get(
                processId
            );

        const userId =
            snapshot.status.userId;

        let userName =
            userNameCache.get(
                userId
            );

        if (!userName) {
            userName =
                await getUserName(
                    userId
                );

            userNameCache.set(
                userId,
                userName
            );
        }

        const residentMemoryBytes =
            snapshot.status
                .residentMemoryBytes ||
            snapshot.stat
                .residentMemoryBytes;

        const virtualMemoryBytes =
            snapshot.status
                .virtualMemoryBytes ||
            snapshot.stat
                .virtualMemoryBytes;

        const startedAt =
            bootTimeMilliseconds +
            (
                snapshot.stat
                    .startTimeTicks /
                CLOCK_TICKS
            ) *
            1000;

        const executableName =
            path.basename(
                snapshot.executablePath ||
                snapshot.stat.processName
            );

        const cpu =
            calculateCpuPercentage(
                firstSnapshot,
                snapshot,
                elapsedNanoseconds
            );

        const status =
            mapLinuxState(
                snapshot.stat.state
            );

        processes.push({
            pid:
                processId,

            processId,

            parentPid:
                snapshot.stat
                    .parentProcessId,

            parentProcessId:
                snapshot.stat
                    .parentProcessId,

            name:
                executableName ||
                snapshot.stat.processName,

            displayName:
                snapshot.stat.processName,

            path:
                snapshot.executablePath,

            executable:
                snapshot.executablePath,

            command:
                snapshot.commandLine ||
                snapshot.stat.processName,

            commandLine:
                snapshot.commandLine,

            user:
                userName,

            userName,

            userId,

            cpu:
                Number(
                    cpu.toFixed(2)
                ),

            cpuPercent:
                Number(
                    cpu.toFixed(2)
                ),

            memory:
                residentMemoryBytes,

            memoryBytes:
                residentMemoryBytes,

            memoryMb:
                Number(
                    (
                        residentMemoryBytes /
                        1024 /
                        1024
                    ).toFixed(2)
                ),

            residentMemory:
                residentMemoryBytes,

            virtualMemory:
                virtualMemoryBytes,

            status,

            state:
                snapshot.stat.state,

            threads:
                snapshot.status
                    .threadCount ||
                snapshot.stat
                    .threadCount,

            priority:
                snapshot.stat.priority,

            nice:
                snapshot.stat.nice,

            startedAt:
                new Date(
                    startedAt
                ).toISOString(),

            uptimeSeconds:
                Math.max(
                    0,
                    (
                        getSystemUptimeTicks() -
                        snapshot.stat
                            .startTimeTicks
                    ) /
                    CLOCK_TICKS
                ),

            icon:
                null
        });
    }

    processes.sort(
        (first, second) =>
            second.cpu -
                first.cpu ||
            second.memoryBytes -
                first.memoryBytes ||
            first.pid -
                second.pid
    );

    return processes;
}

async function ensureIcon(
    executablePath
) {
    const normalizedPath =
        String(
            executablePath || ""
        ).trim();

    if (!normalizedPath) {
        return null;
    }

    await loadDesktopEntries();

    const executableName =
        path.basename(
            normalizedPath
        ).toLowerCase();

    const desktopEntry =
        desktopEntryCache.get(
            executableName
        );

    if (!desktopEntry) {
        return null;
    }

    const sourceIconPath =
        await resolveIconPath(
            desktopEntry.icon
        );

    if (!sourceIconPath) {
        return null;
    }

    return copyIconToCache(
        sourceIconPath,
        `${normalizedPath}:${desktopEntry.icon}`
    );
}

function getIconPath(
    fileName
) {
    const safeFileName =
        path.basename(
            String(
                fileName || ""
            )
        );

    if (
        safeFileName !==
        String(
            fileName || ""
        )
    ) {
        return null;
    }

    const iconPath =
        path.join(
            ICON_CACHE_DIRECTORY,
            safeFileName
        );

    if (
        !fs.existsSync(
            iconPath
        )
    ) {
        return null;
    }

    return iconPath;
}

function protectCriticalProcess(
    processId
) {
    if (processId === 1) {
        throw new Error(
            "PID 1 cannot be controlled from CorePanel."
        );
    }

    if (
        processId ===
        process.pid
    ) {
        throw new Error(
            "CorePanel cannot control its own process."
        );
    }
}

async function sendSignal(
    processId,
    signal
) {
    const normalizedProcessId =
        normalizeProcessId(
            processId
        );

    protectCriticalProcess(
        normalizedProcessId
    );

    try {
        process.kill(
            normalizedProcessId,
            signal
        );
    } catch (error) {
        if (
            error.code === "ESRCH"
        ) {
            throw new Error(
                "The process no longer exists."
            );
        }

        if (
            error.code === "EPERM"
        ) {
            throw new Error(
                "Permission denied while controlling the process."
            );
        }

        throw error;
    }
}

async function endProcess(
    processId
) {
    await sendSignal(
        processId,
        "SIGTERM"
    );

    const normalizedProcessId =
        normalizeProcessId(
            processId
        );

    await wait(800);

    try {
        process.kill(
            normalizedProcessId,
            0
        );
    } catch {
        return;
    }

    await sendSignal(
        normalizedProcessId,
        "SIGKILL"
    );
}

async function suspendProcess(
    processId
) {
    await sendSignal(
        processId,
        "SIGSTOP"
    );
}

async function resumeProcess(
    processId
) {
    await sendSignal(
        processId,
        "SIGCONT"
    );
}

module.exports = {
    getProcesses,
    ensureIcon,
    getIconPath,
    endProcess,
    suspendProcess,
    resumeProcess
};
