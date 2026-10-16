import assert from "node:assert/strict";
import { describe, it } from "node:test";
import bcrypt from "bcryptjs";
import { User } from "../src/models/user.model.js";
import { provisionTpoFromEnvironment } from "../src/services/tpo-bootstrap.service.js";

describe("TPO environment bootstrap", { concurrency: false }, () => {
    const withTpoEnvironment = (t, email, password) => {
        const originalEmail = process.env.TPO_EMAIL;
        const originalPassword = process.env.TPO_PASSWORD;
        if (email === undefined) delete process.env.TPO_EMAIL;
        else process.env.TPO_EMAIL = email;
        if (password === undefined) delete process.env.TPO_PASSWORD;
        else process.env.TPO_PASSWORD = password;
        t.after(() => {
            if (originalEmail === undefined) delete process.env.TPO_EMAIL;
            else process.env.TPO_EMAIL = originalEmail;
            if (originalPassword === undefined) delete process.env.TPO_PASSWORD;
            else process.env.TPO_PASSWORD = originalPassword;
        });
    };

    it("does nothing when bootstrap credentials are not configured", async (t) => {
        withTpoEnvironment(t, undefined, undefined);
        t.mock.method(User, "findOne", async () => assert.fail("should not query users"));
        t.mock.method(User, "create", async () => assert.fail("should not create a user"));

        await provisionTpoFromEnvironment();
    });

    it("creates a TPO with a normalized email and hashed password", async (t) => {
        withTpoEnvironment(t, "  TPO@Example.com ", "strong-password");
        let saved;
        t.mock.method(User, "findOne", async () => null);
        t.mock.method(User, "create", async (input) => { saved = input; });

        await provisionTpoFromEnvironment();

        assert.equal(saved.name, "Placement TPO");
        assert.equal(saved.email, "tpo@example.com");
        assert.equal(saved.role, "TPO");
        assert.equal(await bcrypt.compare("strong-password", saved.password), true);
    });

    it("does not overwrite an existing TPO account", async (t) => {
        withTpoEnvironment(t, "tpo@example.com", "strong-password");
        t.mock.method(User, "findOne", async () => ({ role: "TPO" }));
        t.mock.method(User, "create", async () => assert.fail("should not overwrite an account"));

        await provisionTpoFromEnvironment();
    });

    it("rejects partial or invalid credentials", async (t) => {
        withTpoEnvironment(t, "tpo@example.com", undefined);
        await assert.rejects(provisionTpoFromEnvironment, /must be configured together/);

        process.env.TPO_EMAIL = "not-an-email";
        process.env.TPO_PASSWORD = "strong-password";
        await assert.rejects(provisionTpoFromEnvironment, /valid email address/);

        process.env.TPO_EMAIL = "tpo@example.com";
        process.env.TPO_PASSWORD = "short";
        await assert.rejects(provisionTpoFromEnvironment, /at least 8 characters/);
    });

    it("rejects an email already owned by a non-TPO account", async (t) => {
        withTpoEnvironment(t, "admin@example.com", "strong-password");
        t.mock.method(User, "findOne", async () => ({ role: "ADMIN" }));

        await assert.rejects(provisionTpoFromEnvironment, /non-TPO account/);
    });
});
