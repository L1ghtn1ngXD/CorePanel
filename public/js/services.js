(() => {
    const state = {
        initialized: false,
        active: false,
        loading: false,
        timer: null,
        services: [],
        selectedName: null,
        query: "",
        sortKey: "displayName",
        sortDirection: "asc"
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, options);

        let data;

        try {
            data = await response.json();
        } catch {
            data = {
                message:
                    "The server returned an invalid response."
            };
        }

        if (!response.ok) {
            throw new Error(
                data.message || "Request failed."
            );
        }

        return data;
    }

    function addStyleSheet() {
        if (
            document.querySelector(
                'link[href="/css/services.css"]'
            )
        ) {
            return;
        }

        const link = document.createElement("link");

        link.rel = "stylesheet";
        link.href = "/css/services.css";

        document.head.appendChild(link);
    }

    function createNavigationButton() {
        if (
            document.querySelector(
                '[data-page="services"]'
            )
        ) {
            return;
        }

        const systemInfoButton =
            document.querySelector(
                '[data-page="system-info"]'
            );

        const button = document.createElement(
            "button"
        );

        button.className = "navigation-button";
        button.dataset.page = "services";
        button.type = "button";
        button.textContent = "Services";

        systemInfoButton.parentElement.insertBefore(
            button,
            systemInfoButton
        );
    }

    function createPage() {
        if (
            document.querySelector(
                '[data-page-content="services"]'
            )
        ) {
            return;
        }

        const systemInfoPage =
            document.querySelector(
                '[data-page-content="system-info"]'
            );

        const page = document.createElement(
            "section"
        );

        page.className = "page";
        page.dataset.pageContent = "services";

        page.innerHTML = `
            <div class="services-page">
                <div class="services-header">
                    <div>
                        <p class="page-eyebrow">
                            Windows Services
                        </p>

                        <h2>Services</h2>
                    </div>

                    <div class="services-toolbar">
                        <input
                            id="service-search"
                            class="service-search"
                            type="search"
                            placeholder="Search services..."
                            autocomplete="off"
                        >

                        <button
                            id="service-refresh"
                            class="service-refresh-button"
                            type="button"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div class="service-summary-grid">
                    <article class="service-summary-card">
                        <span>Services</span>
                        <strong id="service-summary-total">0</strong>
                    </article>

                    <article class="service-summary-card">
                        <span>Running</span>
                        <strong id="service-summary-running">0</strong>
                    </article>

                    <article class="service-summary-card">
                        <span>Stopped</span>
                        <strong id="service-summary-stopped">0</strong>
                    </article>

                    <article class="service-summary-card">
                        <span>Automatic</span>
                        <strong id="service-summary-automatic">0</strong>
                    </article>

                    <article class="service-summary-card">
                        <span>Manual</span>
                        <strong id="service-summary-manual">0</strong>
                    </article>

                    <article class="service-summary-card">
                        <span>Disabled</span>
                        <strong id="service-summary-disabled">0</strong>
                    </article>
                </div>

                <div class="service-table-container">
                    <div class="service-table-header">
                        <button
                            class="service-column-button"
                            data-service-sort="name"
                            type="button"
                        >
                            Service name
                        </button>

                        <button
                            class="service-column-button"
                            data-service-sort="displayName"
                            type="button"
                        >
                            Display name
                        </button>

                        <button
                            class="service-column-button"
                            data-service-sort="status"
                            type="button"
                        >
                            Status
                        </button>

                        <button
                            class="service-column-button"
                            data-service-sort="startType"
                            type="button"
                        >
                            Startup type
                        </button>

                        <button
                            class="service-column-button"
                            data-service-sort="processId"
                            type="button"
                        >
                            PID
                        </button>
                    </div>

                    <div
                        id="service-table-body"
                        class="service-table-body"
                    >
                        <div class="service-loading">
                            Loading services...
                        </div>
                    </div>
                </div>

                <div
                    id="service-selection-panel"
                    class="service-selection-panel"
                >
                    <div class="service-selection-empty">
                        Select a service to manage it.
                    </div>

                    <div class="service-selection-content">
                        <div class="service-selection-info">
                            <div class="service-selection-title">
                                <strong
                                    id="selected-service-display-name"
                                ></strong>

                                <span
                                    id="selected-service-name"
                                ></span>
                            </div>

                            <div class="service-selection-meta">
                                <span
                                    id="selected-service-status"
                                ></span>

                                <span
                                    id="selected-service-pid"
                                ></span>
                            </div>

                            <div
                                id="selected-service-path"
                                class="service-selection-path"
                            ></div>

                            <div
                                id="service-message"
                                class="service-message"
                            ></div>
                        </div>

                        <div class="service-selection-actions">
                            <button
                                id="service-start"
                                class="service-action-button"
                                type="button"
                            >
                                Start
                            </button>

                            <button
                                id="service-stop"
                                class="service-action-button danger"
                                type="button"
                            >
                                Stop
                            </button>

                            <button
                                id="service-restart"
                                class="service-action-button"
                                type="button"
                            >
                                Restart
                            </button>

                            <select
                                id="service-startup-type"
                                class="service-startup-select"
                            >
                                <option value="Automatic">
                                    Automatic
                                </option>

                                <option value="Automatic Delayed">
                                    Automatic Delayed
                                </option>

                                <option value="Manual">
                                    Manual
                                </option>

                                <option value="Disabled">
                                    Disabled
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <div
                    id="service-count-label"
                    class="service-count-label"
                ></div>
            </div>
        `;

        systemInfoPage.parentElement.insertBefore(
            page,
            systemInfoPage
        );
    }

    function getPage() {
        return document.querySelector(
            '[data-page-content="services"]'
        );
    }

    function bindEvents() {
        document
            .getElementById("service-search")
            .addEventListener(
                "input",
                (event) => {
                    state.query =
                        event.target.value
                            .trim()
                            .toLowerCase();

                    renderServices();
                }
            );

        document
            .getElementById("service-refresh")
            .addEventListener(
                "click",
                loadServices
            );

        document
            .querySelectorAll(
                "[data-service-sort]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        const key =
                            button.dataset.serviceSort;

                        if (state.sortKey === key) {
                            state.sortDirection =
                                state.sortDirection === "asc"
                                    ? "desc"
                                    : "asc";
                        } else {
                            state.sortKey = key;

                            state.sortDirection =
                                key === "processId"
                                    ? "desc"
                                    : "asc";
                        }

                        renderServices();
                    }
                );
            });

        document
            .getElementById("service-start")
            .addEventListener(
                "click",
                () => performAction("start")
            );

        document
            .getElementById("service-stop")
            .addEventListener(
                "click",
                () => performAction("stop")
            );

        document
            .getElementById("service-restart")
            .addEventListener(
                "click",
                () => performAction("restart")
            );

        document
            .getElementById(
                "service-startup-type"
            )
            .addEventListener(
                "change",
                changeStartupType
            );
    }

    function getFilteredServices() {
        return state.services
            .filter((service) => {
                if (!state.query) {
                    return true;
                }

                return (
                    service.name
                        .toLowerCase()
                        .includes(state.query) ||
                    service.displayName
                        .toLowerCase()
                        .includes(state.query) ||
                    service.status
                        .toLowerCase()
                        .includes(state.query) ||
                    service.startType
                        .toLowerCase()
                        .includes(state.query) ||
                    String(service.processId)
                        .includes(state.query)
                );
            })
            .sort((first, second) => {
                let firstValue =
                    first[state.sortKey];

                let secondValue =
                    second[state.sortKey];

                if (
                    typeof firstValue === "string"
                ) {
                    firstValue =
                        firstValue.toLowerCase();

                    secondValue =
                        String(secondValue || "")
                            .toLowerCase();
                }

                if (firstValue < secondValue) {
                    return state.sortDirection === "asc"
                        ? -1
                        : 1;
                }

                if (firstValue > secondValue) {
                    return state.sortDirection === "asc"
                        ? 1
                        : -1;
                }

                return 0;
            });
    }

    function getStatusClass(status) {
        const normalized = String(status)
            .toLowerCase();

        if (normalized === "running") {
            return "running";
        }

        if (normalized === "stopped") {
            return "stopped";
        }

        if (normalized === "paused") {
            return "paused";
        }

        return "pending";
    }

    function renderServices() {
        const body = document.getElementById(
            "service-table-body"
        );

        const services = getFilteredServices();

        document.getElementById(
            "service-count-label"
        ).textContent =
            `${services.length} of ` +
            `${state.services.length} services`;

        if (services.length === 0) {
            body.innerHTML = `
                <div class="service-empty">
                    No services found.
                </div>
            `;

            updateSelection();
            return;
        }

        body.innerHTML = services
            .map((service) => {
                const selected =
                    service.name ===
                    state.selectedName
                        ? " selected"
                        : "";

                return `
                    <div
                        class="service-row${selected}"
                        data-service-name="${escapeHtml(
                            service.name
                        )}"
                    >
                        <div class="service-cell service-name">
                            ${escapeHtml(service.name)}
                        </div>

                        <div class="service-cell">
                            ${escapeHtml(
                                service.displayName
                            )}
                        </div>

                        <div class="service-cell">
                            <span
                                class="service-status ${getStatusClass(
                                    service.status
                                )}"
                            >
                                ${escapeHtml(
                                    service.status
                                )}
                            </span>
                        </div>

                        <div class="service-cell">
                            ${escapeHtml(
                                service.startType
                            )}
                        </div>

                        <div class="service-cell">
                            ${
                                service.processId > 0
                                    ? service.processId
                                    : "—"
                            }
                        </div>
                    </div>
                `;
            })
            .join("");

        body
            .querySelectorAll(".service-row")
            .forEach((row) => {
                row.addEventListener(
                    "click",
                    () => {
                        state.selectedName =
                            row.dataset.serviceName;

                        renderServices();
                        updateSelection();
                    }
                );
            });

        updateSelection();
    }

    function updateSummary() {
        const running = state.services.filter(
            (service) =>
                service.status === "Running"
        ).length;

        const stopped = state.services.filter(
            (service) =>
                service.status === "Stopped"
        ).length;

        const automatic = state.services.filter(
            (service) =>
                service.startType === "Automatic" ||
                service.startType ===
                    "Automatic Delayed"
        ).length;

        const manual = state.services.filter(
            (service) =>
                service.startType === "Manual"
        ).length;

        const disabled = state.services.filter(
            (service) =>
                service.startType === "Disabled"
        ).length;

        document.getElementById(
            "service-summary-total"
        ).textContent = state.services.length;

        document.getElementById(
            "service-summary-running"
        ).textContent = running;

        document.getElementById(
            "service-summary-stopped"
        ).textContent = stopped;

        document.getElementById(
            "service-summary-automatic"
        ).textContent = automatic;

        document.getElementById(
            "service-summary-manual"
        ).textContent = manual;

        document.getElementById(
            "service-summary-disabled"
        ).textContent = disabled;
    }

    function updateSelection() {
        const service = state.services.find(
            (item) =>
                item.name === state.selectedName
        );

        const panel = document.getElementById(
            "service-selection-panel"
        );

        if (!service) {
            state.selectedName = null;
            panel.classList.remove("expanded");
            return;
        }

        panel.classList.add("expanded");

        document.getElementById(
            "selected-service-display-name"
        ).textContent = service.displayName;

        document.getElementById(
            "selected-service-name"
        ).textContent = service.name;

        document.getElementById(
            "selected-service-status"
        ).textContent = service.status;

        document.getElementById(
            "selected-service-pid"
        ).textContent =
            service.processId > 0
                ? `PID ${service.processId}`
                : "No active process";

        document.getElementById(
            "selected-service-path"
        ).textContent =
            service.path ||
            "Executable path is unavailable.";

        document.getElementById(
            "service-message"
        ).textContent = "";

        const startupSelect =
            document.getElementById(
                "service-startup-type"
            );

        if (
            [
                "Automatic",
                "Automatic Delayed",
                "Manual",
                "Disabled"
            ].includes(service.startType)
        ) {
            startupSelect.value =
                service.startType;
        }

        const running =
            service.status === "Running";

        document.getElementById(
            "service-start"
        ).disabled = running;

        document.getElementById(
            "service-stop"
        ).disabled = !running;

        document.getElementById(
            "service-restart"
        ).disabled = !running;
    }

    function setControlsDisabled(disabled) {
        document.getElementById(
            "service-start"
        ).disabled = disabled;

        document.getElementById(
            "service-stop"
        ).disabled = disabled;

        document.getElementById(
            "service-restart"
        ).disabled = disabled;

        document.getElementById(
            "service-startup-type"
        ).disabled = disabled;
    }

    async function performAction(action) {
        if (!state.selectedName) {
            return;
        }

        const service = state.services.find(
            (item) =>
                item.name === state.selectedName
        );

        if (!service) {
            return;
        }

        if (
            action === "stop" ||
            action === "restart"
        ) {
            const confirmed = window.confirm(
                `${action === "stop" ? "Stop" : "Restart"} ` +
                `${service.displayName}?`
            );

            if (!confirmed) {
                return;
            }
        }

        const message = document.getElementById(
            "service-message"
        );

        message.textContent = "";
        setControlsDisabled(true);

        try {
            await requestJson(
                `/api/services/${encodeURIComponent(
                    service.name
                )}/${action}`,
                {
                    method: "POST"
                }
            );

            await loadServices();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            setControlsDisabled(false);
            updateSelection();
        }
    }

    async function changeStartupType(event) {
        if (!state.selectedName) {
            return;
        }

        const message = document.getElementById(
            "service-message"
        );

        message.textContent = "";
        setControlsDisabled(true);

        try {
            await requestJson(
                `/api/services/${encodeURIComponent(
                    state.selectedName
                )}/startup`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        startType:
                            event.target.value
                    })
                }
            );

            await loadServices();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            setControlsDisabled(false);
            updateSelection();
        }
    }

    async function loadServices() {
        if (state.loading) {
            return;
        }

        state.loading = true;

        const refreshButton =
            document.getElementById(
                "service-refresh"
            );

        refreshButton.disabled = true;

        try {
            const response = await requestJson(
                "/api/services"
            );

            state.services =
                Array.isArray(response.services)
                    ? response.services
                    : [];

            if (
                state.selectedName &&
                !state.services.some(
                    (service) =>
                        service.name ===
                        state.selectedName
                )
            ) {
                state.selectedName = null;
            }

            renderServices();
            updateSummary();
        } catch (error) {
            document.getElementById(
                "service-table-body"
            ).innerHTML = `
                <div class="service-empty">
                    ${escapeHtml(error.message)}
                </div>
            `;
        } finally {
            state.loading = false;
            refreshButton.disabled = false;
        }
    }

    function start() {
        state.active = true;

        loadServices();

        if (state.timer === null) {
            state.timer = window.setInterval(
                () => {
                    if (state.active) {
                        loadServices();
                    }
                },
                5000
            );
        }
    }

    function stop() {
        state.active = false;
    }

    function initialize() {
        if (state.initialized) {
            return;
        }

        addStyleSheet();
        createNavigationButton();
        createPage();
        bindEvents();

        state.initialized = true;

        const observer = new MutationObserver(
            () => {
                if (
                    getPage().classList.contains(
                        "active"
                    )
                ) {
                    start();
                } else {
                    stop();
                }
            }
        );

        observer.observe(getPage(), {
            attributes: true,
            attributeFilter: ["class"]
        });

        if (
            getPage().classList.contains(
                "active"
            )
        ) {
            start();
        }
    }

    window.CorePanelServices = {
        initialize,
        start,
        stop
    };

    initialize();
})();