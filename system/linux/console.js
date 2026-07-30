const os = require("os");
const path = require("path");
const pty = require("node-pty");

function getDefaultShell() {
    const configuredShell =
        String(
            process.env.SHELL || ""
        ).trim();

    if (configuredShell) {
        return configuredShell;
    }

    return "/bin/bash";
}

function getWorkingDirectory() {
    const homeDirectory =
        os.homedir();

    if (homeDirectory) {
        return homeDirectory;
    }

    return process.cwd();
}

function createTerminal(options = {}) {
    const columns =
        Math.max(
            20,
            Math.min(
                400,
                Number(
                    options.columns
                ) || 100
            )
        );

    const rows =
        Math.max(
            5,
            Math.min(
                200,
                Number(
                    options.rows
                ) || 30
            )
        );

    const shell =
        getDefaultShell();

    const workingDirectory =
        getWorkingDirectory();

    const environment = {
        ...process.env,

        TERM:
            process.env.TERM ||
            "xterm-256color",

        COLORTERM:
            process.env.COLORTERM ||
            "truecolor",

        LANG:
            process.env.LANG ||
            "C.UTF-8",

        LC_ALL:
            process.env.LC_ALL ||
            process.env.LANG ||
            "C.UTF-8",

        HOME:
            process.env.HOME ||
            os.homedir(),

        SHELL:
            shell
    };

    const terminal =
        pty.spawn(
            shell,
            [
                "--login"
            ],
            {
                name:
                    "xterm-256color",

                cols:
                    columns,

                rows,

                cwd:
                    workingDirectory,

                env:
                    environment
            }
        );

    return terminal;
}

module.exports = {
    createTerminal
};
