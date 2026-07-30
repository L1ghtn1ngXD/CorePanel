const os = require("os");
const pty = require("node-pty");

function getShell() {
    const systemRoot = process.env.SystemRoot || "C:\\Windows";

    return {
        file: process.env.ComSpec || `${systemRoot}\\System32\\cmd.exe`,
        args: []
    };
}

function createTerminal(options = {}) {
    const shell = getShell();

    const columns = Math.max(
        20,
        Math.min(400, Number(options.columns) || 100)
    );

    const rows = Math.max(
        5,
        Math.min(200, Number(options.rows) || 30)
    );

    return pty.spawn(shell.file, shell.args, {
        name: "xterm-256color",
        cols: columns,
        rows,
        cwd: options.cwd || os.homedir(),
        env: {
            ...process.env,
            TERM: "xterm-256color",
            COLORTERM: "truecolor"
        }
    });
}

module.exports = {
    createTerminal
};