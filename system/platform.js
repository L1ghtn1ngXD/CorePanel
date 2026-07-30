const os = require("os");

const currentPlatform = os.platform();

switch (currentPlatform) {
    case "win32":
        module.exports = require("./windows");
        break;

    case "linux":
        module.exports = require("./linux");
        break;

    default:
        throw new Error(
            `CorePanel does not support this platform: ${currentPlatform}`
        );
}