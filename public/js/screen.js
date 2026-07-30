(() => {
    const state = {
        initialized: false,
        modulePromise: null,
        rfb: null,
        connected: false,
        connecting: false,
        manuallyDisconnected: false,
        reconnectTimer: null,
        reconnectAttempts: 0,
        keyboardEnabled: true,
        mouseEnabled: true,
        mouseButtonsEnabled: true
    };

    function getElement(id) {
        return document.getElementById(id);
    }

    async function requestJson(
        url,
        options = {}
    ) {
        const response =
            await fetch(url, options);

        let data;

        try {
            data =
                await response.json();
        } catch {
            data = {
                message:
                    "The server returned an invalid response."
            };
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Request failed."
            );
        }

        return data;
    }

    function activateScreenPage() {
        document
            .querySelectorAll(
                "[data-page]"
            )
            .forEach((button) => {
                button.classList.toggle(
                    "active",
                    button.dataset.page ===
                        "screen"
                );
            });

        document
            .querySelectorAll(
                "[data-page-content]"
            )
            .forEach((page) => {
                page.classList.toggle(
                    "active",
                    page.dataset.pageContent ===
                        "screen"
                );
            });

        if (
            !state.connected &&
            !state.connecting &&
            !state.manuallyDisconnected
        ) {
            connect();
        }
    }

    function createNavigationButton() {
        const existingButton =
            document.querySelector(
                '[data-page="screen"]'
            );

        if (existingButton) {
            existingButton.addEventListener(
                "click",
                activateScreenPage
            );

            return;
        }

        const systemInfoButton =
            document.querySelector(
                '[data-page="system-info"]'
            );

        if (!systemInfoButton) {
            return;
        }

        const button =
            document.createElement(
                "button"
            );

        button.className =
            systemInfoButton.className ||
            "navigation-button";

        button.dataset.page =
            "screen";

        button.type =
            "button";

        button.textContent =
            "Screen";

        button.addEventListener(
            "click",
            activateScreenPage
        );

        systemInfoButton.parentElement.insertBefore(
            button,
            systemInfoButton
        );
    }

    function removeWindowsQemu() {
        document.querySelector(
            '[data-page="qemu"]'
        )?.remove();

        document.querySelector(
            '[data-page-content="qemu"]'
        )?.remove();
    }

    function createPage() {
        if (
            document.querySelector(
                '[data-page-content="screen"]'
            )
        ) {
            return;
        }

        const systemInfoPage =
            document.querySelector(
                '[data-page-content="system-info"]'
            );

        if (!systemInfoPage) {
            return;
        }

        const page =
            document.createElement(
                "section"
            );

        page.className =
            "page";

        page.dataset.pageContent =
            "screen";

        page.innerHTML = `
            <div class="screen-page">
                <div class="screen-header">
                    <div>
                        <p class="page-eyebrow">
                            Remote desktop
                        </p>

                        <h2>Screen</h2>
                    </div>

                    <div
                        id="screen-status"
                        class="screen-status"
                    >
                        <span
                            class="screen-status-dot"
                        ></span>

                        <span id="screen-status-text">
                            Disconnected
                        </span>
                    </div>
                </div>

                <div class="screen-toolbar">
                    <button
                        id="screen-reconnect"
                        class="screen-button"
                        type="button"
                    >
                        Reconnect
                    </button>

                    <button
                        id="screen-disconnect"
                        class="screen-button danger"
                        type="button"
                        disabled
                    >
                        Disconnect
                    </button>

                    <button
                        id="screen-ctrl-alt-del"
                        class="screen-button"
                        type="button"
                        disabled
                    >
                        Ctrl+Alt+Del
                    </button>

                    <button
                        id="screen-screenshot"
                        class="screen-button"
                        type="button"
                        disabled
                    >
                        Screenshot
                    </button>

                    <button
                        id="screen-fullscreen"
                        class="screen-button"
                        type="button"
                    >
                        Fullscreen
                    </button>

                    <div class="screen-controls">
                        <label class="screen-checkbox">
                            <input
                                id="screen-keyboard"
                                type="checkbox"
                                checked
                            >
                            <span>Keyboard</span>
                        </label>

                        <label class="screen-checkbox">
                            <input
                                id="screen-mouse"
                                type="checkbox"
                                checked
                            >
                            <span>Mouse</span>
                        </label>

                        <label class="screen-checkbox">
                            <input
                                id="screen-mouse-buttons"
                                type="checkbox"
                                checked
                            >
                            <span>MouseBtn</span>
                        </label>
                    </div>
                </div>

                <div
                    id="screen-frame"
                    class="screen-frame"
                >
                    <div
                        id="screen-display"
                        class="screen-display"
                        tabindex="0"
                    ></div>

                    <div
                        id="screen-placeholder"
                        class="screen-placeholder"
                    >
                        Open Screen to connect.
                    </div>
                </div>

                <div class="screen-footer">
                    <span
                        id="screen-message"
                        class="screen-message"
                    >
                        Remote desktop is ready.
                    </span>

                    <span
                        id="screen-desktop-name"
                        class="screen-desktop-name"
                    ></span>
                </div>
            </div>
        `;

        systemInfoPage.parentElement.insertBefore(
            page,
            systemInfoPage
        );
    }

    function setStatus(
        status,
        text
    ) {
        const element =
            getElement(
                "screen-status"
            );

        if (!element) {
            return;
        }

        element.classList.remove(
            "connected",
            "connecting",
            "error"
        );

        if (status) {
            element.classList.add(
                status
            );
        }

        getElement(
            "screen-status-text"
        ).textContent =
            text;
    }

    function setMessage(message) {
        const element =
            getElement(
                "screen-message"
            );

        if (element) {
            element.textContent =
                message;
        }
    }

    function updateButtons() {
        getElement(
            "screen-reconnect"
        ).disabled =
            state.connecting;

        getElement(
            "screen-disconnect"
        ).disabled =
            !state.connected &&
            !state.connecting;

        getElement(
            "screen-ctrl-alt-del"
        ).disabled =
            !state.connected ||
            !state.keyboardEnabled;

        getElement(
            "screen-screenshot"
        ).disabled =
            !state.connected;
    }

    function getWebSocketUrl() {
        const protocol =
            window.location.protocol ===
            "https:"
                ? "wss:"
                : "ws:";

        return (
            `${protocol}//` +
            `${window.location.host}` +
            "/api/screen/vnc"
        );
    }

    function loadRfbModule() {
        if (!state.modulePromise) {
            state.modulePromise = import(
                "/vendor/novnc/core/rfb.js"
            );
        }

        return state.modulePromise;
    }

    function clearReconnectTimer() {
        if (!state.reconnectTimer) {
            return;
        }

        clearTimeout(
            state.reconnectTimer
        );

        state.reconnectTimer =
            null;
    }

    function applyInputSettings() {
        if (!state.rfb) {
            return;
        }

        state.rfb.viewOnly =
            !state.keyboardEnabled &&
            !state.mouseEnabled &&
            !state.mouseButtonsEnabled;

        state.rfb.focusOnClick =
            state.keyboardEnabled;

        if (!state.keyboardEnabled) {
            state.rfb.blur();
        }

        updateButtons();
    }

    function installInputFilters() {
        const display =
            getElement(
                "screen-display"
            );

        function stopEvent(event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }

        window.addEventListener(
            "keydown",
            (event) => {
                if (
                    state.rfb &&
                    !state.keyboardEnabled &&
                    display.contains(
                        event.target
                    )
                ) {
                    stopEvent(event);
                }
            },
            true
        );

        window.addEventListener(
            "keyup",
            (event) => {
                if (
                    state.rfb &&
                    !state.keyboardEnabled &&
                    display.contains(
                        event.target
                    )
                ) {
                    stopEvent(event);
                }
            },
            true
        );

        [
            "mousemove",
            "pointermove",
            "touchmove"
        ].forEach((eventName) => {
            display.addEventListener(
                eventName,
                (event) => {
                    if (
                        state.rfb &&
                        !state.mouseEnabled
                    ) {
                        stopEvent(event);
                    }
                },
                true
            );
        });

        [
            "mousedown",
            "mouseup",
            "pointerdown",
            "pointerup",
            "click",
            "dblclick",
            "contextmenu",
            "wheel",
            "touchstart",
            "touchend"
        ].forEach((eventName) => {
            display.addEventListener(
                eventName,
                (event) => {
                    if (
                        state.rfb &&
                        !state.mouseButtonsEnabled
                    ) {
                        stopEvent(event);
                    }
                },
                true
            );
        });
    }

    function scheduleReconnect() {
        clearReconnectTimer();

        if (
            state.manuallyDisconnected ||
            state.reconnectAttempts >= 3
        ) {
            return;
        }

        const delay =
            2000 *
            Math.max(
                1,
                state.reconnectAttempts
            );

        state.reconnectTimer =
            setTimeout(
                connect,
                delay
            );

        setMessage(
            `Reconnecting in ${Math.ceil(
                delay / 1000
            )} seconds...`
        );
    }

    function finishDisconnect(
        clean,
        message
    ) {
        state.connected =
            false;

        state.connecting =
            false;

        state.rfb =
            null;

        if (
            clean &&
            state.manuallyDisconnected
        ) {
            setStatus(
                "",
                "Disconnected"
            );

            setMessage(
                message ||
                "Disconnected from remote desktop."
            );
        } else {
            setStatus(
                "error",
                "Connection lost"
            );

            setMessage(
                message ||
                "The remote desktop connection was closed."
            );

            state.reconnectAttempts +=
                1;

            scheduleReconnect();
        }

        updateButtons();
    }

    async function ensureRemoteDesktop() {
        setStatus(
            "connecting",
            "Starting"
        );

        setMessage(
            "Starting UltraVNC..."
        );

        const status =
            await requestJson(
                "/api/screen/start",
                {
                    method: "POST"
                }
            );

        if (!status.supported) {
            throw new Error(
                "Screen is only supported on Windows."
            );
        }

        if (!status.ready) {
            throw new Error(
                status.error ||
                "UltraVNC is not ready."
            );
        }
    }

    async function connect() {
        if (
            state.rfb ||
            state.connecting
        ) {
            return;
        }

        clearReconnectTimer();

        state.manuallyDisconnected =
            false;

        state.connecting =
            true;

        setStatus(
            "connecting",
            "Connecting"
        );

        setMessage(
            "Preparing remote desktop..."
        );

        updateButtons();

        try {
            await ensureRemoteDesktop();

            const credentials =
                await requestJson(
                    "/api/screen/credentials",
                    {
                        cache: "no-store"
                    }
                );

            const module =
                await loadRfbModule();

            const RFB =
                module.default;

            const display =
                getElement(
                    "screen-display"
                );

            display.replaceChildren();

            const rfb =
                new RFB(
                    display,
                    getWebSocketUrl(),
                    {
                        shared: true,
                        credentials: {
                            password:
                                credentials.password
                        }
                    }
                );

            state.rfb =
                rfb;

            rfb.scaleViewport =
                true;

            rfb.resizeSession =
                false;

            rfb.clipViewport =
                true;

            rfb.focusOnClick =
                true;

            rfb.qualityLevel =
                7;

            rfb.compressionLevel =
                4;

            applyInputSettings();

            rfb.addEventListener(
                "connect",
                () => {
                    state.connected =
                        true;

                    state.connecting =
                        false;

                    state.reconnectAttempts =
                        0;

                    getElement(
                        "screen-placeholder"
                    ).classList.add(
                        "hidden"
                    );

                    setStatus(
                        "connected",
                        "Connected"
                    );

                    setMessage(
                        "Remote desktop connection established."
                    );

                    updateButtons();
                }
            );

            rfb.addEventListener(
                "disconnect",
                (event) => {
                    finishDisconnect(
                        event.detail.clean
                    );
                }
            );

            rfb.addEventListener(
                "credentialsrequired",
                () => {
                    rfb.sendCredentials({
                        password:
                            credentials.password
                    });
                }
            );

            rfb.addEventListener(
                "desktopname",
                (event) => {
                    getElement(
                        "screen-desktop-name"
                    ).textContent =
                        event.detail.name ||
                        "";
                }
            );

            rfb.addEventListener(
                "securityfailure",
                (event) => {
                    state.manuallyDisconnected =
                        true;

                    setStatus(
                        "error",
                        "Security failure"
                    );

                    setMessage(
                        event.detail.reason ||
                        "UltraVNC rejected the connection."
                    );
                }
            );
        } catch (error) {
            state.rfb =
                null;

            state.connecting =
                false;

            state.connected =
                false;

            setStatus(
                "error",
                "Connection failed"
            );

            setMessage(
                error.message ||
                "Failed to start remote desktop."
            );

            updateButtons();

            state.reconnectAttempts +=
                1;

            scheduleReconnect();
        }
    }

    function disconnect() {
        clearReconnectTimer();

        state.manuallyDisconnected =
            true;

        if (!state.rfb) {
            state.connected =
                false;

            state.connecting =
                false;

            setStatus(
                "",
                "Disconnected"
            );

            setMessage(
                "Disconnected from remote desktop."
            );

            updateButtons();
            return;
        }

        setStatus(
            "connecting",
            "Disconnecting"
        );

        setMessage(
            "Closing remote desktop connection..."
        );

        try {
            state.rfb.disconnect();
        } catch {
            finishDisconnect(
                true
            );
        }
    }

    function reconnect() {
        clearReconnectTimer();

        state.manuallyDisconnected =
            true;

        if (state.rfb) {
            try {
                state.rfb.disconnect();
            } catch {
            }
        }

        state.rfb =
            null;

        state.connected =
            false;

        state.connecting =
            false;

        state.reconnectAttempts =
            0;

        state.manuallyDisconnected =
            false;

        setTimeout(
            connect,
            250
        );
    }

    function sendCtrlAltDel() {
        if (
            state.rfb &&
            state.connected &&
            state.keyboardEnabled
        ) {
            state.rfb.sendCtrlAltDel();
        }
    }

    function takeScreenshot() {
        if (
            !state.rfb ||
            !state.connected
        ) {
            return;
        }

        const screenshotWindow =
            window.open(
                "about:blank",
                "_blank"
            );

        state.rfb.toBlob(
            (blob) => {
                if (!blob) {
                    screenshotWindow?.close();

                    setMessage(
                        "Failed to create the screenshot."
                    );

                    return;
                }

                const objectUrl =
                    URL.createObjectURL(
                        blob
                    );

                if (screenshotWindow) {
                    screenshotWindow.location.href =
                        objectUrl;
                }

                setMessage(
                    "Screenshot opened in a new tab."
                );

                setTimeout(
                    () => {
                        URL.revokeObjectURL(
                            objectUrl
                        );
                    },
                    60000
                );
            },
            "image/png"
        );
    }

    async function toggleFullscreen() {
        const frame =
            getElement(
                "screen-frame"
            );

        try {
            if (
                document.fullscreenElement
            ) {
                await document.exitFullscreen();
            } else {
                await frame.requestFullscreen();
            }
        } catch (error) {
            setMessage(
                error.message ||
                "Fullscreen mode is unavailable."
            );
        }
    }

    function saveInputSettings() {
        localStorage.setItem(
            "corepanel_screen_keyboard",
            String(
                state.keyboardEnabled
            )
        );

        localStorage.setItem(
            "corepanel_screen_mouse",
            String(
                state.mouseEnabled
            )
        );

        localStorage.setItem(
            "corepanel_screen_mouse_buttons",
            String(
                state.mouseButtonsEnabled
            )
        );
    }

    function loadInputSettings() {
        state.keyboardEnabled =
            localStorage.getItem(
                "corepanel_screen_keyboard"
            ) !== "false";

        state.mouseEnabled =
            localStorage.getItem(
                "corepanel_screen_mouse"
            ) !== "false";

        state.mouseButtonsEnabled =
            localStorage.getItem(
                "corepanel_screen_mouse_buttons"
            ) !== "false";

        getElement(
            "screen-keyboard"
        ).checked =
            state.keyboardEnabled;

        getElement(
            "screen-mouse"
        ).checked =
            state.mouseEnabled;

        getElement(
            "screen-mouse-buttons"
        ).checked =
            state.mouseButtonsEnabled;
    }

    function bindEvents() {
        getElement(
            "screen-reconnect"
        ).addEventListener(
            "click",
            reconnect
        );

        getElement(
            "screen-disconnect"
        ).addEventListener(
            "click",
            disconnect
        );

        getElement(
            "screen-ctrl-alt-del"
        ).addEventListener(
            "click",
            sendCtrlAltDel
        );

        getElement(
            "screen-screenshot"
        ).addEventListener(
            "click",
            takeScreenshot
        );

        getElement(
            "screen-fullscreen"
        ).addEventListener(
            "click",
            toggleFullscreen
        );

        getElement(
            "screen-keyboard"
        ).addEventListener(
            "change",
            (event) => {
                state.keyboardEnabled =
                    event.target.checked;

                applyInputSettings();
                saveInputSettings();
            }
        );

        getElement(
            "screen-mouse"
        ).addEventListener(
            "change",
            (event) => {
                state.mouseEnabled =
                    event.target.checked;

                applyInputSettings();
                saveInputSettings();
            }
        );

        getElement(
            "screen-mouse-buttons"
        ).addEventListener(
            "change",
            (event) => {
                state.mouseButtonsEnabled =
                    event.target.checked;

                applyInputSettings();
                saveInputSettings();
            }
        );
    }

    async function initialize() {
        if (state.initialized) {
            return;
        }

        try {
            const platform =
                await requestJson(
                    "/api/platform"
                );

            const platformName =
                String(
                    platform.platform ||
                    ""
                ).toLowerCase();

            if (
                !platformName.includes(
                    "win"
                )
            ) {
                return;
            }
        } catch {
            return;
        }

        removeWindowsQemu();
        createNavigationButton();
        createPage();

        if (
            !getElement(
                "screen-display"
            )
        ) {
            return;
        }

        loadInputSettings();
        installInputFilters();
        bindEvents();
        updateButtons();

        state.initialized =
            true;
    }

    window.CorePanelScreen = {
        initialize,
        connect,
        disconnect,
        reconnect,
        takeScreenshot,
        activateScreenPage
    };

    initialize();
})();
