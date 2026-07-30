module.exports = {
    name: "Linux",

    console:
        require("./console"),

    processes:
        require("./processes"),

    services:
        require("./services"),

    files:
        require("./files"),

    systemInfo:
        require("./system-info"),
};
