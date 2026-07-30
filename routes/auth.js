const express = require("express");
const bcrypt = require("bcryptjs");

const database = require("../data/database");

const router = express.Router();

function getUser() {
    return database
        .prepare(`
            SELECT id, username, password_hash
            FROM users
            LIMIT 1
        `)
        .get();
}

router.get("/status", (req, res) => {
    const user = getUser();

    res.json({
        registered: Boolean(user),
        authenticated: Boolean(req.session.userId),
        username: req.session.username || null
    });
});

router.post("/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        if (getUser()) {
            return res.status(403).json({
                success: false,
                message: "An account has already been created."
            });
        }

        if (username.length < 3 || username.length > 32) {
            return res.status(400).json({
                success: false,
                message: "Username must contain between 3 and 32 characters."
            });
        }

        if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
            return res.status(400).json({
                success: false,
                message: "Username contains unsupported characters."
            });
        }

        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({
                success: false,
                message: "Password must contain between 8 and 128 characters."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = database
            .prepare(`
                INSERT INTO users (username, password_hash)
                VALUES (?, ?)
            `)
            .run(username, passwordHash);

        res.json({
            success: true,
            userId: result.lastInsertRowid
        });
    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create the account."
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        const user = getUser();

        if (!user) {
            return res.status(403).json({
                success: false,
                message: "CorePanel has not been configured yet."
            });
        }

        if (username !== user.username) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({
            success: true
        });
    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to log in."
        });
    }
});

router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to log out."
            });
        }

        res.clearCookie("corepanel.sid");

        res.json({
            success: true
        });
    });
});

router.get("/me", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            authenticated: false
        });
    }

    res.json({
        authenticated: true,
        username: req.session.username
    });
});

module.exports = router;