(() => {
    const state = {
        initialized: false,
        active: false,
        loading: false,
        timer: null,
        processes: [],
        selectedPid: null,
        query: "",
        sortKey: "cpu",
        sortDirection: "desc",
        iconRequests: new Set()
    };

    function getPage() {
        return document.querySelector(
            '[data-page-content="task-manager"]'
        );
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, options);

        let data;

        try {
            data = await response.json();
        } catch {
            data = {
                message: "The server returned an invalid response."
            };
        }

        if (!response.ok) {
            throw new Error(data.message || "Request failed.");
        }

        return data;
    }

    function formatBytes(bytes) {
        const value = Math.max(0, Number(bytes) || 0);

        if (value >= 1024 ** 3) {
            return `${(value / 1024 ** 3).toFixed(1)} GB`;
        }

        if (value >= 1024 ** 2) {
            return `${(value / 1024 ** 2).toFixed(1)} MB`;
        }

        if (value >= 1024) {
            return `${(value / 1024).toFixed(0)} KB`;
        }

        return `${value} B`;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function createLayout() {
        const page = getPage();

        page.innerHTML = `
            <div class="task-manager-page">
                <div class="task-manager-header">
                    <div>
                        <p class="page-eyebrow">Processes</p>
                        <h2>Task Manager</h2>
                    </div>

                    <div class="task-manager-toolbar">
                        <input
                            id="process-search"
                            class="process-search"
                            type="search"
                            placeholder="Search processes..."
                            autocomplete="off"
                        >

                        <button
                            id="process-refresh"
                            class="process-toolbar-button"
                            type="button"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div class="process-summary-grid">
                    <article class="process-summary-card">
                        <span>Processes</span>
                        <strong id="summary-processes">0</strong>
                    </article>

                    <article class="process-summary-card">
                        <span>Running</span>
                        <strong id="summary-running">0</strong>
                    </article>

                    <article class="process-summary-card">
                        <span>Total CPU</span>
                        <strong id="summary-cpu">0%</strong>
                    </article>

                    <article class="process-summary-card">
                        <span>Total RAM</span>
                        <strong id="summary-ram">0 MB</strong>
                    </article>

                    <article class="process-summary-card">
                        <span>Selected</span>
                        <strong id="summary-selected">None</strong>
                    </article>
                </div>

                <div class="process-table-container">
                    <div class="process-table-header">
                        <button class="process-column-button" data-sort="name" type="button">
                            Process
                        </button>

                        <button class="process-column-button" data-sort="pid" type="button">
                            PID
                        </button>

                        <button class="process-column-button" data-sort="cpu" type="button">
                            CPU
                        </button>

                        <button class="process-column-button" data-sort="memory" type="button">
                            RAM
                        </button>

                        <button class="process-column-button" data-sort="user" type="button">
                            User
                        </button>

                        <button class="process-column-button" data-sort="state" type="button">
                            Status
                        </button>
                    </div>

                    <div id="process-table-body" class="process-table-body">
                        <div class="process-loading">Loading processes...</div>
                    </div>
                </div>

                <div
                    id="process-selection-panel"
                    class="process-selection-panel"
                >
                    <div class="process-selection-empty">
                        Select a process to manage it.
                    </div>

                    <div class="process-selection-content">
                        <div class="process-selection-info">
                            <div class="process-selection-title">
                                <strong id="selected-process-name"></strong>
                                <span id="selected-process-pid"></span>
                            </div>

                            <div
                                id="selected-process-path"
                                class="process-selection-path"
                            ></div>

                            <div
                                id="process-message"
                                class="process-message"
                            ></div>
                        </div>

                        <div class="process-selection-actions">
                            <button
                                id="process-end"
                                class="process-action-button danger"
                                type="button"
                            >
                                End Process
                            </button>

                            <button
                                id="process-suspend"
                                class="process-action-button"
                                type="button"
                            >
                                Suspend
                            </button>

                            <button
                                id="process-resume"
                                class="process-action-button"
                                type="button"
                            >
                                Resume
                            </button>
                        </div>
                    </div>
                </div>

                <div id="process-count-label" class="process-count-label"></div>
            </div>
        `;

        document
            .getElementById("process-search")
            .addEventListener("input", (event) => {
                state.query = event.target.value.trim().toLowerCase();
                renderProcesses();
            });

        document
            .getElementById("process-refresh")
            .addEventListener("click", loadProcesses);

        document
            .querySelectorAll("[data-sort]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    const key = button.dataset.sort;

                    if (state.sortKey === key) {
                        state.sortDirection =
                            state.sortDirection === "asc"
                                ? "desc"
                                : "asc";
                    } else {
                        state.sortKey = key;
                        state.sortDirection =
                            key === "name" || key === "user"
                                ? "asc"
                                : "desc";
                    }

                    renderProcesses();
                });
            });

        document
            .getElementById("process-end")
            .addEventListener("click", () => performAction("end"));

        document
            .getElementById("process-suspend")
            .addEventListener("click", () => performAction("suspend"));

        document
            .getElementById("process-resume")
            .addEventListener("click", () => performAction("resume"));
    }

    function getFilteredProcesses() {
        const filtered = state.processes.filter((processInfo) => {
            if (!state.query) {
                return true;
            }

            return (
                processInfo.name.toLowerCase().includes(state.query) ||
                String(processInfo.pid).includes(state.query) ||
                processInfo.user.toLowerCase().includes(state.query) ||
                String(processInfo.path || "")
                    .toLowerCase()
                    .includes(state.query)
            );
        });

        return filtered.sort((first, second) => {
            let firstValue = first[state.sortKey];
            let secondValue = second[state.sortKey];

            if (typeof firstValue === "string") {
                firstValue = firstValue.toLowerCase();
                secondValue = String(secondValue || "").toLowerCase();
            }

            if (firstValue < secondValue) {
                return state.sortDirection === "asc" ? -1 : 1;
            }

            if (firstValue > secondValue) {
                return state.sortDirection === "asc" ? 1 : -1;
            }

            return 0;
        });
    }

    function renderProcesses() {
        const body = document.getElementById("process-table-body");

        if (!body) {
            return;
        }

        const processes = getFilteredProcesses();

        document.getElementById("process-count-label").textContent =
            `${processes.length} of ${state.processes.length} processes`;

        if (processes.length === 0) {
            body.innerHTML = `
                <div class="process-empty">
                    No processes found.
                </div>
            `;

            updateSelection();
            return;
        }

        const maximumMemory = Math.max(
            ...state.processes.map((processInfo) => processInfo.memory),
            1
        );

        body.innerHTML = processes
            .map((processInfo) => {
                const cpuWidth = Math.min(
                    100,
                    Math.max(0, processInfo.cpu)
                );

                const memoryWidth = Math.min(
                    100,
                    (processInfo.memory / maximumMemory) * 100
                );

                const selected =
                    processInfo.pid === state.selectedPid
                        ? " selected"
                        : "";

                const suspended =
                    String(processInfo.state).toLowerCase().includes("suspend");

                const statusClass = suspended
                    ? "suspended"
                    : "running";

                const statusText = suspended
                    ? "Suspended"
                    : "Running";

                return `
                    <div
                        class="process-row${selected}"
                        data-pid="${processInfo.pid}"
                    >
                        <div class="process-row-cell process-name-cell">
                            ${
                                processInfo.icon
                                    ? `
                                        <img
                                            class="process-icon"
                                            src="${escapeHtml(processInfo.icon)}"
                                            data-process-path="${escapeHtml(processInfo.path || "")}"
                                            alt=""
                                        >
                                    `
                                    : `
                                        <div class="process-icon-fallback">
                                            ${escapeHtml(processInfo.name.slice(0, 1).toUpperCase())}
                                        </div>
                                    `
                            }

                            <span class="process-name-text">
                                ${escapeHtml(processInfo.name)}
                            </span>
                        </div>

                        <div class="process-row-cell">
                            ${processInfo.pid}
                        </div>

                        <div class="process-row-cell process-resource-cell">
                            <span class="process-resource-value">
                                ${processInfo.cpu.toFixed(1)}%
                            </span>

                            <div class="process-resource-bar">
                                <div
                                    class="process-resource-fill"
                                    style="width: ${cpuWidth}%"
                                ></div>
                            </div>
                        </div>

                        <div class="process-row-cell process-resource-cell">
                            <span class="process-resource-value">
                                ${formatBytes(processInfo.memory)}
                            </span>

                            <div class="process-resource-bar">
                                <div
                                    class="process-resource-fill"
                                    style="width: ${memoryWidth}%"
                                ></div>
                            </div>
                        </div>

                        <div class="process-row-cell">
                            ${escapeHtml(processInfo.user || "Unknown")}
                        </div>

                        <div class="process-row-cell">
                            <span class="process-status ${statusClass}">
                                ${statusText}
                            </span>
                        </div>
                    </div>
                `;
            })
            .join("");

        body.querySelectorAll(".process-row").forEach((row) => {
            row.addEventListener("click", () => {
                state.selectedPid = Number(row.dataset.pid);
                renderProcesses();
                updateSelection();
            });
        });

        body.querySelectorAll(".process-icon").forEach((image) => {
            image.addEventListener("error", () => {
                const executablePath = image.dataset.processPath;

                image.style.visibility = "hidden";

                if (executablePath) {
                    requestProcessIcon(executablePath, image);
                }
            });
        });

        updateSelection();
    }

    async function requestProcessIcon(executablePath, image) {
        if (
            !executablePath ||
            state.iconRequests.has(executablePath)
        ) {
            return;
        }

        state.iconRequests.add(executablePath);

        try {
            const response = await requestJson("/api/processes/icon", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    path: executablePath
                })
            });

            if (response.icon) {
                image.src = response.icon;
                image.style.visibility = "visible";
            }
        } catch {
        } finally {
            state.iconRequests.delete(executablePath);
        }
    }

    function updateSummary() {
        const totalCpu = state.processes.reduce(
            (total, processInfo) => total + processInfo.cpu,
            0
        );

        const totalMemory = state.processes.reduce(
            (total, processInfo) => total + processInfo.memory,
            0
        );

        const running = state.processes.filter(
            (processInfo) =>
                !String(processInfo.state)
                    .toLowerCase()
                    .includes("suspend")
        ).length;

        const selected = state.processes.find(
            (processInfo) => processInfo.pid === state.selectedPid
        );

        document.getElementById("summary-processes").textContent =
            state.processes.length;

        document.getElementById("summary-running").textContent =
            running;

        document.getElementById("summary-cpu").textContent =
            `${Math.min(100, totalCpu).toFixed(1)}%`;

        document.getElementById("summary-ram").textContent =
            formatBytes(totalMemory);

        document.getElementById("summary-selected").textContent =
            selected ? selected.name : "None";
    }

    function updateSelection() {
        const selected = state.processes.find(
            (processInfo) => processInfo.pid === state.selectedPid
        );

        const panel = document.getElementById(
            "process-selection-panel"
        );

        if (!selected) {
            state.selectedPid = null;
            panel.classList.remove("expanded");
            updateSummary();
            return;
        }

        panel.classList.add("expanded");

        document.getElementById("selected-process-name").textContent =
            selected.name;

        document.getElementById("selected-process-pid").textContent =
            `PID ${selected.pid}`;

        document.getElementById("selected-process-path").textContent =
            selected.path || "Executable path is unavailable.";

        document.getElementById("process-message").textContent = "";

        updateSummary();
    }

    function setActionButtonsDisabled(disabled) {
        document.getElementById("process-end").disabled = disabled;
        document.getElementById("process-suspend").disabled = disabled;
        document.getElementById("process-resume").disabled = disabled;
    }

    async function performAction(action) {
        if (!state.selectedPid) {
            return;
        }

        const message = document.getElementById("process-message");

        message.textContent = "";
        setActionButtonsDisabled(true);

        try {
            await requestJson(
                `/api/processes/${state.selectedPid}/${action}`,
                {
                    method: "POST"
                }
            );

            if (action === "end") {
                state.selectedPid = null;
            }

            await loadProcesses();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            setActionButtonsDisabled(false);
        }
    }

    async function loadProcesses() {
        if (state.loading) {
            return;
        }

        state.loading = true;

        try {
            const response = await requestJson("/api/processes");

            state.processes = Array.isArray(response.processes)
                ? response.processes
                : [];

            if (
                state.selectedPid &&
                !state.processes.some(
                    (processInfo) =>
                        processInfo.pid === state.selectedPid
                )
            ) {
                state.selectedPid = null;
            }

            renderProcesses();
            updateSummary();
        } catch (error) {
            const body = document.getElementById("process-table-body");

            body.innerHTML = `
                <div class="process-empty">
                    ${escapeHtml(error.message)}
                </div>
            `;
        } finally {
            state.loading = false;
        }
    }

    function start() {
        state.active = true;

        loadProcesses();

        if (state.timer === null) {
            state.timer = window.setInterval(() => {
                if (state.active) {
                    loadProcesses();
                }
            }, 2000);
        }
    }

    function stop() {
        state.active = false;
    }

    function initialize() {
        if (state.initialized) {
            return;
        }

        createLayout();
        state.initialized = true;

        const observer = new MutationObserver(() => {
            const page = getPage();

            if (page.classList.contains("active")) {
                start();
            } else {
                stop();
            }
        });

        observer.observe(getPage(), {
            attributes: true,
            attributeFilter: ["class"]
        });

        if (getPage().classList.contains("active")) {
            start();
        }
    }

    window.CorePanelTaskManager = {
        initialize,
        start,
        stop
    };

    initialize();
})();